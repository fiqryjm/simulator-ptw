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
