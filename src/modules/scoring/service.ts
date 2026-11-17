import {
  AdditionalPermitStatus,
  PermitStatus,
  Prisma,
  Role,
  SessionStatus,
} from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_SCORING_WEIGHTS,
  parseTenantSettings,
  type ScoringWeights,
} from '@/lib/datetime';
import { assertRole, assertTenantAccess, getEffectiveRole, type SessionUser } from '@/lib/rbac';
import { ServiceError } from '@/modules/permit/errors';
import { DEFAULT_PTW_TEMPLATE_SCHEMA } from '@/modules/permit/default-templates';
import { flattenPtwFields, type PtwTemplateSchema } from '@/modules/permit/template-schema';
import { type SeededError } from '@/modules/scenario/default-scenarios';
import { getValidFieldPathsForTemplate, parseSeededErrors } from '@/modules/scenario/service';

export const MAX_FLAGS_PER_PERMIT = 50;
export const FALSE_POSITIVE_PENALTY = 10;

export const createFlagSchema = z.object({
  fieldPath: z.string().trim().min(1),
  reason: z.string().trim().min(10, 'Alasan penandaan kesalahan minimal 10 karakter'),
});

export interface ScoreComputationInput {
  participantRole: Role;
  seededErrors: SeededError[];
  participantFlags: Array<{ fieldPath: string }>;
  allPermitFlags: Array<{ fieldPath: string }>;
  ptwCompletenessPct: number;
  hasJsaWithSteps: boolean;
  additionalPermits: Array<{ status: AdditionalPermitStatus }>;
  transitions: Array<{
    fromStatus: PermitStatus;
    toStatus: PermitStatus;
    actorRole: string;
  }>;
  weights?: ScoringWeights;
}

export interface ComputedScoreResult {
  totalScore: number;
  breakdown: {
    documentCompleteness: number;
    hazardIdentification: number;
    procedureCompliance: number;
    additionalPermitsAndIsolation: number;
    matchedErrorIds: string[];
    missedErrorIds: string[];
    falsePositiveCount: number;
  };
}

function clampScore(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val * 100) / 100));
}

function findMatchingSeededError(
  fieldPath: string,
  seededErrors: SeededError[],
): SeededError | undefined {
  return seededErrors.find(
    (err) => err.fieldPath === fieldPath || err.acceptedFieldPaths.includes(fieldPath),
  );
}

/**
 * Pure scoring function implementing the approved M2 Scoring Specification.
 */
export function computeParticipantScore(input: ScoreComputationInput): ComputedScoreResult {
  const weights = input.weights ?? DEFAULT_SCORING_WEIGHTS;
  const matchedByParticipant = new Set<string>();
  let falsePositiveCount = 0;

  for (const flag of input.participantFlags) {
    const matched = findMatchingSeededError(flag.fieldPath, input.seededErrors);
    if (matched) {
      matchedByParticipant.add(matched.id);
    } else {
      falsePositiveCount += 1;
    }
  }

  const matchedAnyOnPermit = new Set<string>();
  for (const flag of input.allPermitFlags) {
    const matched = findMatchingSeededError(flag.fieldPath, input.seededErrors);
    if (matched) {
      matchedAnyOnPermit.add(matched.id);
    }
  }

  const computeErrorDetectionPct = (
    component: SeededError['component'],
  ): { hasRelevant: boolean; pct: number } => {
    const relevant = input.seededErrors.filter(
      (e) => e.component === component && e.relevantRoles.includes(input.participantRole),
    );
    if (relevant.length === 0) {
      return { hasRelevant: false, pct: 100 };
    }
    const totalPoints = relevant.reduce((sum, e) => sum + e.points, 0);
    const matchedPoints = relevant
      .filter((e) => matchedByParticipant.has(e.id))
      .reduce((sum, e) => sum + e.points, 0);
    return {
      hasRelevant: true,
      pct: totalPoints > 0 ? (matchedPoints / totalPoints) * 100 : 100,
    };
  };

  // Distribute false-positive penalty across the 2 primary detection components (or all)
  const fpPenalty = falsePositiveCount * FALSE_POSITIVE_PENALTY;

  // 1. COMPLETENESS
  const compDetection = computeErrorDetectionPct('COMPLETENESS');
  const compBase = compDetection.hasRelevant
    ? 0.5 * input.ptwCompletenessPct + 0.5 * compDetection.pct
    : input.ptwCompletenessPct;
  const documentCompleteness = clampScore(Math.max(0, compBase - fpPenalty * 0.25));

  // 2. HAZARD_IDENTIFICATION
  const hazDetection = computeErrorDetectionPct('HAZARD_IDENTIFICATION');
  const hazBase = hazDetection.hasRelevant
    ? hazDetection.pct
    : input.hasJsaWithSteps
      ? 100
      : 0;
  const hazardIdentification = clampScore(Math.max(0, hazBase - fpPenalty * 0.5));

  // 3. PROCEDURE
  const roleTransitions = input.transitions.filter(
    (t) => t.actorRole === input.participantRole,
  );
  let procScore = roleTransitions.length > 0 ? 100 : 0;

  if (input.participantRole === Role.APPLICANT) {
    const returnedCount = input.transitions.filter(
      (t) => t.toStatus === PermitStatus.RETURNED,
    ).length;
    procScore = Math.max(0, procScore - returnedCount * 10);
  }

  const unflaggedCriticalCount = input.seededErrors.filter(
    (e) => e.severity === 'CRITICAL' && !matchedAnyOnPermit.has(e.id),
  ).length;

  if (input.participantRole === Role.SUPERVISOR) {
    const approvedCritical = input.transitions.some(
      (t) =>
        t.actorRole === Role.SUPERVISOR &&
        t.fromStatus === PermitStatus.SUBMITTED &&
        t.toStatus === PermitStatus.PENDING_ISSUANCE,
    );
    if (approvedCritical && unflaggedCriticalCount > 0) {
      procScore = Math.max(0, procScore - unflaggedCriticalCount * 30);
    }
  }

  if (input.participantRole === Role.ISSUER) {
    const issuedCritical = input.transitions.some(
      (t) =>
        t.actorRole === Role.ISSUER &&
        t.fromStatus === PermitStatus.PENDING_ISSUANCE &&
        t.toStatus === PermitStatus.APPROVED,
    );
    if (issuedCritical && unflaggedCriticalCount > 0) {
      procScore = Math.max(0, procScore - unflaggedCriticalCount * 30);
    }
  }

  const procedureCompliance = clampScore(Math.max(0, procScore - fpPenalty * 0.125));

  // 4. ADDITIONAL_PERMIT_ISOLATION
  const addTotal = input.additionalPermits.length;
  const addApproved = input.additionalPermits.filter(
    (a) => a.status === AdditionalPermitStatus.APPROVED,
  ).length;
  const addCompletionPct = addTotal === 0 ? 100 : (addApproved / addTotal) * 100;
  const addDetection = computeErrorDetectionPct('ADDITIONAL_PERMIT_ISOLATION');
  const addBase = addDetection.hasRelevant
    ? 0.5 * addCompletionPct + 0.5 * addDetection.pct
    : addCompletionPct;
  const additionalPermitsAndIsolation = clampScore(Math.max(0, addBase - fpPenalty * 0.125));

  const weighted =
    (documentCompleteness * weights.documentCompleteness +
      hazardIdentification * weights.hazardIdentification +
      procedureCompliance * weights.procedureCompliance +
      additionalPermitsAndIsolation * weights.additionalPermitsAndIsolation) /
    100;

  const relevantIds = input.seededErrors
    .filter((e) => e.relevantRoles.includes(input.participantRole))
    .map((e) => e.id);
  const matchedErrorIds = relevantIds.filter((id) => matchedByParticipant.has(id));
  const missedErrorIds = relevantIds.filter((id) => !matchedByParticipant.has(id));

  return {
    totalScore: clampScore(weighted),
    breakdown: {
      documentCompleteness,
      hazardIdentification,
      procedureCompliance,
      additionalPermitsAndIsolation,
      matchedErrorIds,
      missedErrorIds,
      falsePositiveCount,
    },
  };
}

function calculatePtwCompletenessPct(
  ptwTemplate: PtwTemplateSchema,
  dataJson: Record<string, unknown>,
): number {
  const requiredFields = flattenPtwFields(ptwTemplate).filter((f) => f.required);
  if (requiredFields.length === 0) return 100;
  let filled = 0;
  for (const field of requiredFields) {
    const val = dataJson[field.key];
    if (val !== undefined && val !== null && String(val).trim().length > 0) {
      filled += 1;
    }
  }
  return (filled / requiredFields.length) * 100;
}

/**
 * Recomputes and persists Score rows for all participants in a session.
 */
export async function recalculateSessionScores(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      tenant: true,
      scenario: true,
      participants: true,
      permits: {
        include: {
          additionalPermits: true,
          jsaRecords: true,
          transitions: true,
          errorFlags: true,
        },
      },
    },
  });

  if (!session) return;

  const settings = parseTenantSettings(session.tenant.settings);
  const seededErrors = parseSeededErrors(session.scenario.seededErrorsJson);
  const permit = session.permits[0];
  if (!permit) return;

  const ptwCompletenessPct = calculatePtwCompletenessPct(
    DEFAULT_PTW_TEMPLATE_SCHEMA,
    (permit.dataJson as Record<string, unknown>) ?? {},
  );
  const jsaData = permit.jsaRecords[0]?.dataJson as Record<string, unknown> | undefined;
  const hasJsaWithSteps = Array.isArray(jsaData?.steps) && jsaData.steps.length > 0;

  for (const participant of session.participants) {
    const participantFlags = permit.errorFlags.filter(
      (f) => f.participantId === participant.id,
    );

    const computed = computeParticipantScore({
      participantRole: participant.simulatedRole,
      seededErrors,
      participantFlags,
      allPermitFlags: permit.errorFlags,
      ptwCompletenessPct,
      hasJsaWithSteps,
      additionalPermits: permit.additionalPermits,
      transitions: permit.transitions,
      weights: settings.scoringWeights,
    });

    await prisma.score.upsert({
      where: {
        sessionId_participantId: {
          sessionId: session.id,
          participantId: participant.id,
        },
      },
      update: {
        totalScore: computed.totalScore,
        breakdownJson: computed.breakdown as unknown as Prisma.InputJsonValue,
      },
      create: {
        tenantId: session.tenantId,
        sessionId: session.id,
        participantId: participant.id,
        totalScore: computed.totalScore,
        breakdownJson: computed.breakdown as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

export async function flagPermitError(
  user: SessionUser,
  permitId: string,
  rawInput: unknown,
) {
  const parsed = createFlagSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ServiceError(422, 'Data penandaan kesalahan tidak valid', {
      issues: parsed.error.flatten(),
    });
  }

  const permit = await prisma.permit.findUnique({
    where: { id: permitId },
    include: {
      session: {
        include: {
          scenario: true,
          participants: true,
        },
      },
      errorFlags: true,
    },
  });

  if (!permit) {
    throw new ServiceError(404, 'Izin tidak ditemukan');
  }

  assertTenantAccess(user, permit.tenantId);

  const participant = permit.session.participants.find((p) => p.userId === user.id);
  if (!participant) {
    throw new ServiceError(403, 'Hanya peserta sesi yang dapat menandai kesalahan');
  }

  if (participant.finalizedAt || permit.session.status === SessionStatus.COMPLETED) {
    throw new ServiceError(409, 'Penandaan kesalahan sudah dikunci setelah latihan diselesaikan');
  }

  if (permit.errorFlags.length >= MAX_FLAGS_PER_PERMIT) {
    throw new ServiceError(422, `Batas maksimal ${MAX_FLAGS_PER_PERMIT} flag per izin tercapai`);
  }

  const validPaths = getValidFieldPathsForTemplate(DEFAULT_PTW_TEMPLATE_SCHEMA);
  if (!validPaths.has(parsed.data.fieldPath)) {
    throw new ServiceError(422, 'fieldPath tidak dikenal pada template skenario');
  }

  const seededErrors = parseSeededErrors(permit.session.scenario.seededErrorsJson);
  const matched = findMatchingSeededError(parsed.data.fieldPath, seededErrors);

  const flag = await prisma.errorFlag.create({
    data: {
      tenantId: permit.tenantId,
      permitId: permit.id,
      participantId: participant.id,
      seededErrorId: matched?.id ?? null,
      fieldPath: parsed.data.fieldPath,
      reason: parsed.data.reason,
    },
  });

  await recalculateSessionScores(permit.sessionId);

  // Never leak whether the flag matched a seededError during active training
  return {
    id: flag.id,
    fieldPath: flag.fieldPath,
    reason: flag.reason,
    at: flag.at,
  };
}

export async function finalizeParticipantSession(user: SessionUser, sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { participants: true },
  });

  if (!session) {
    throw new ServiceError(404, 'Sesi tidak ditemukan');
  }

  assertTenantAccess(user, session.tenantId);

  const participant = session.participants.find((p) => p.userId === user.id);
  if (!participant) {
    throw new ServiceError(403, 'Anda bukan peserta pada sesi ini');
  }

  if (!participant.finalizedAt) {
    await prisma.participant.update({
      where: { id: participant.id },
      data: { finalizedAt: new Date() },
    });
  }

  await recalculateSessionScores(session.id);
  return { finalized: true };
}

/**
 * Returns participant's own flags and — ONLY if finalized or session COMPLETED —
 * the detailed feedback (found, missed, false positives, explanations, score).
 */
export async function getPermitFlagsAndFeedback(user: SessionUser, permitId: string) {
  const permit = await prisma.permit.findUnique({
    where: { id: permitId },
    include: {
      session: {
        include: {
          scenario: true,
          participants: true,
          scores: true,
        },
      },
      errorFlags: { orderBy: { at: 'asc' } },
    },
  });

  if (!permit) {
    throw new ServiceError(404, 'Izin tidak ditemukan');
  }

  assertTenantAccess(user, permit.tenantId);

  const effectiveRole = getEffectiveRole(user, permit.session);
  const participant = permit.session.participants.find((p) => p.userId === user.id);
  const isManager =
    permit.session.instructorId === user.id ||
    user.role === Role.TENANT_ADMIN ||
    user.role === Role.SUPER_ADMIN;

  if (!participant && !isManager) {
    throw new ServiceError(403, 'Akses ditolak');
  }

  const visibleFlags = participant
    ? permit.errorFlags.filter((f) => f.participantId === participant.id)
    : permit.errorFlags;

  const unlocked =
    isManager ||
    Boolean(participant?.finalizedAt) ||
    permit.session.status === SessionStatus.COMPLETED;

  if (!unlocked) {
    return {
      unlocked: false,
      effectiveRole,
      flags: visibleFlags.map((f) => ({
        id: f.id,
        fieldPath: f.fieldPath,
        reason: f.reason,
        at: f.at,
      })),
    };
  }

  const seededErrors = parseSeededErrors(permit.session.scenario.seededErrorsJson);
  const scoreRow = participant
    ? permit.session.scores.find((s) => s.participantId === participant.id)
    : null;

  const matchedIds = new Set<string>();
  const falsePositives: Array<{ id: string; fieldPath: string; reason: string }> = [];

  for (const flag of visibleFlags) {
    const matched = findMatchingSeededError(flag.fieldPath, seededErrors);
    if (matched) {
      matchedIds.add(matched.id);
    } else {
      falsePositives.push({ id: flag.id, fieldPath: flag.fieldPath, reason: flag.reason });
    }
  }

  const relevantErrors = participant
    ? seededErrors.filter((e) => e.relevantRoles.includes(participant.simulatedRole))
    : seededErrors;

  return {
    unlocked: true,
    effectiveRole,
    flags: visibleFlags.map((f) => ({
      id: f.id,
      fieldPath: f.fieldPath,
      reason: f.reason,
      at: f.at,
    })),
    feedback: {
      totalScore: scoreRow?.totalScore ?? null,
      breakdown: scoreRow?.breakdownJson ?? null,
      foundErrors: relevantErrors.filter((e) => matchedIds.has(e.id)),
      missedErrors: relevantErrors.filter((e) => !matchedIds.has(e.id)),
      falsePositives,
    },
  };
}

/**
 * Prevents CSV formula injection (Excel/Sheets) by prefixing cells starting with
 * =, +, -, @, tab, or carriage return with a single apostrophe.
 */
export function sanitizeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  const needsPrefix = /^[=+\-@\t\r]/.test(str);
  const safe = needsPrefix ? `'${str}` : str;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function exportSessionScoresCsv(user: SessionUser, sessionId: string) {
  assertRole(user, [Role.INSTRUCTOR, Role.TENANT_ADMIN, Role.SUPER_ADMIN]);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      scenario: true,
      participants: {
        include: {
          user: { select: { name: true, email: true } },
          errorFlags: true,
          scores: true,
        },
      },
    },
  });

  if (!session) {
    throw new ServiceError(404, 'Sesi tidak ditemukan');
  }

  assertTenantAccess(user, session.tenantId);

  if (user.role === Role.INSTRUCTOR && session.instructorId !== user.id) {
    throw new ServiceError(403, 'Hanya instruktur sesi ini yang dapat mengekspor laporan');
  }

  const headers = [
    'Session',
    'Scenario',
    'Participant Name',
    'Email',
    'Simulated Role',
    'Finalized',
    'Total Score',
    'Flags Count',
    'Flag Reasons',
  ];

  const rows = session.participants.map((p) => {
    const score = p.scores.find((s) => s.sessionId === session.id);
    const reasons = p.errorFlags.map((f) => `${f.fieldPath}: ${f.reason}`).join(' | ');
    return [
      session.joinCode,
      session.scenario.title,
      p.user.name,
      p.user.email,
      p.simulatedRole,
      p.finalizedAt ? 'YES' : 'NO',
      score ? score.totalScore.toFixed(2) : '0.00',
      String(p.errorFlags.length),
      reasons,
    ]
      .map(sanitizeCsvCell)
      .join(',');
  });

  const csvBody = [headers.map(sanitizeCsvCell).join(','), ...rows].join('\r\n');
  // UTF-8 BOM for Excel compatibility
  return `\uFEFF${csvBody}`;
}
