import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertRole, assertTenantAccess, type SessionUser } from '@/lib/rbac';
import { ServiceError } from '@/modules/permit/errors';
import {
  DEFAULT_ADDITIONAL_PERMIT_TEMPLATES,
  DEFAULT_PTW_TEMPLATE_SCHEMA,
} from '@/modules/permit/default-templates';
import { flattenPtwFields, type PtwTemplateSchema } from '@/modules/permit/template-schema';
import {
  scenarioInitialDataSchema,
  seededErrorSchema,
  type ScenarioInitialData,
  type SeededError,
} from '@/modules/scenario/default-scenarios';

const MANAGER_ROLES: readonly Role[] = [Role.INSTRUCTOR, Role.TENANT_ADMIN, Role.SUPER_ADMIN];

export function parseSeededErrors(raw: unknown): SeededError[] {
  if (!Array.isArray(raw)) return [];
  const parsed: SeededError[] = [];
  for (const item of raw) {
    const res = seededErrorSchema.safeParse(item);
    if (res.success) {
      parsed.push(res.data);
    }
  }
  return parsed;
}

export function parseScenarioInitialData(raw: unknown): ScenarioInitialData {
  const parsed = scenarioInitialDataSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  return {
    isIllustrativeExample: true,
    validationNotice: 'CONTOH ILUSTRATIF — WAJIB DIVALIDASI PAKAR K3',
    validFromOffsetMinutes: 0,
    validToOffsetMinutes: 480,
    ptwData: {},
  };
}

/**
 * Resolves relative minute offsets in scenario initialDataJson into concrete UTC Date bounds.
 */
export function resolveScenarioDates(
  initialData: ScenarioInitialData,
  baseNow: Date = new Date(),
): { validFrom: Date; validTo: Date } {
  const validFrom = new Date(
    baseNow.getTime() + initialData.validFromOffsetMinutes * 60 * 1000,
  );
  const validTo = new Date(baseNow.getTime() + initialData.validToOffsetMinutes * 60 * 1000);
  if (validTo <= validFrom) {
    return {
      validFrom,
      validTo: new Date(validFrom.getTime() + 8 * 60 * 60 * 1000),
    };
  }
  return { validFrom, validTo };
}

/**
 * Returns all valid canonical fieldPath values derived from PTW, ADDITIONAL, and JSA schemas.
 */
export function getValidFieldPathsForTemplate(
  ptwTemplate: PtwTemplateSchema = DEFAULT_PTW_TEMPLATE_SCHEMA,
): Set<string> {
  const paths = new Set<string>();

  for (const field of flattenPtwFields(ptwTemplate)) {
    paths.add(`ptw.${field.key}`);
    if (field.requireNotesOnYes) {
      paths.add(`ptw.${field.key}_notes`);
    }
  }

  for (const addTpl of DEFAULT_ADDITIONAL_PERMIT_TEMPLATES) {
    for (const field of addTpl.fields) {
      paths.add(`additional.${addTpl.type}.${field.key}`);
    }
  }

  for (const checklistKey of [
    'firePrevention',
    'ppe',
    'poweredEquipment',
    'workPlatform',
    'barricades',
  ]) {
    paths.add(`jsa.checklists.${checklistKey}`);
  }

  for (let i = 0; i < 10; i++) {
    for (const prop of ['activity', 'hazardCode', 'hazardDescription', 'controlMeasure']) {
      paths.add(`jsa.steps[${i}].${prop}`);
    }
  }

  return paths;
}

export interface PermitFixSnapshot {
  ptwData: Record<string, unknown>;
  additionalPermits: Array<{ type: string; dataJson: Record<string, unknown> }>;
  jsaData?: Record<string, unknown>;
  initialPtwData?: Record<string, unknown>;
}

function getNestedValue(obj: Record<string, unknown> | undefined, path: string): unknown {
  if (!obj) return undefined;
  const parts = path.split('.');
  let curr: unknown = obj;
  for (const part of parts) {
    if (curr && typeof curr === 'object' && part in (curr as Record<string, unknown>)) {
      curr = (curr as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return curr;
}

/**
 * Evaluates whether a seededError has actually been fixed in the live Permit / AdditionalPermit / JsaRecord data.
 */
export function isSeededErrorFixed(err: SeededError, snapshot: PermitFixSnapshot): boolean {
  const rule = err.fixRule;
  if (!rule) {
    // Fallback: compare PTW field against initialPtwData
    if (err.fieldPath.startsWith('ptw.')) {
      const key = err.fieldPath.slice(4);
      const currVal = snapshot.ptwData[key];
      const initVal = snapshot.initialPtwData?.[key];
      return currVal !== undefined && currVal !== initVal && String(currVal).trim().length > 0;
    }
    return false;
  }

  if (rule.target === 'PTW') {
    const val = snapshot.ptwData[rule.fieldPath];
    if (rule.expectedType === 'EQUALS') {
      return val === rule.expectedValue;
    }
    if (rule.expectedType === 'NOT_EMPTY') {
      return val !== undefined && val !== null && String(val).trim().length > 0;
    }
    if (rule.expectedType === 'NUMERIC_MAX') {
      const num = typeof val === 'number' ? val : Number(val);
      return !Number.isNaN(num) && val !== '' && val !== undefined && num <= Number(rule.expectedValue ?? 0);
    }
    return false;
  }

  if (rule.target === 'ADDITIONAL') {
    const dotIdx = rule.fieldPath.indexOf('.');
    if (dotIdx === -1) return false;
    const addType = rule.fieldPath.slice(0, dotIdx);
    const fieldKey = rule.fieldPath.slice(dotIdx + 1);
    const addRecord = snapshot.additionalPermits.find((ap) => ap.type === addType);
    if (!addRecord) return false;
    const val = addRecord.dataJson[fieldKey];

    if (rule.expectedType === 'EQUALS') {
      return val === rule.expectedValue;
    }
    if (rule.expectedType === 'NOT_EMPTY') {
      return val !== undefined && val !== null && String(val).trim().length > 0;
    }
    if (rule.expectedType === 'NUMERIC_MAX') {
      const num = typeof val === 'number' ? val : Number(val);
      return (
        val !== undefined &&
        val !== null &&
        val !== '' &&
        !Number.isNaN(num) &&
        num <= Number(rule.expectedValue ?? 0)
      );
    }
    return false;
  }

  // JSA
  if (rule.expectedType === 'ARRAY_CONTAINS_CODE') {
    const steps = Array.isArray(snapshot.jsaData?.steps)
      ? (snapshot.jsaData?.steps as Array<Record<string, unknown>>)
      : [];
    return steps.some((s) => s.hazardCode === rule.expectedValue);
  }

  const jsaVal = getNestedValue(snapshot.jsaData, rule.fieldPath);
  if (rule.expectedType === 'EQUALS') {
    return jsaVal === rule.expectedValue;
  }
  if (rule.expectedType === 'NOT_EMPTY') {
    return jsaVal !== undefined && jsaVal !== null && String(jsaVal).trim().length > 0;
  }
  return false;
}

export function evaluateUnfixedCriticalErrors(
  seededErrors: SeededError[],
  snapshot: PermitFixSnapshot,
): string[] {
  return seededErrors
    .filter((err) => err.severity === 'CRITICAL' && !isSeededErrorFixed(err, snapshot))
    .map((err) => err.id);
}

/**
 * Lists scenarios for manager roles only (INSTRUCTOR, TENANT_ADMIN, SUPER_ADMIN).
 * Never exposed to participant roles so seededErrorsJson cannot leak.
 */
export async function listScenariosForManager(user: SessionUser) {
  assertRole(user, MANAGER_ROLES);
  return prisma.scenario.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getScenarioForManager(user: SessionUser, scenarioId: string) {
  assertRole(user, MANAGER_ROLES);
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
  if (!scenario) {
    throw new ServiceError(404, 'Skenario tidak ditemukan');
  }
  assertTenantAccess(user, scenario.tenantId);
  return scenario;
}
