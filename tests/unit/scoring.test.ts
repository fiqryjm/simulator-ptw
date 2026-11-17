import { AdditionalPermitStatus, PermitStatus, Role, SessionStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scoringWeightsSchema } from '@/lib/datetime';
import { prisma } from '@/lib/prisma';
import type { SessionUser } from '@/lib/rbac';
import { DEFAULT_MVP_SCENARIOS } from '@/modules/scenario/default-scenarios';
import {
  computeParticipantScore,
  flagPermitError,
  getPermitFlagsAndFeedback,
  MAX_FLAGS_PER_PERMIT,
  sanitizeCsvCell,
} from '@/modules/scoring/service';

const applicantUser: SessionUser = {
  id: 'u-app',
  email: 'app@demo.ptw.local',
  name: 'Applicant',
  role: Role.APPLICANT,
  tenantId: 'tenant-1',
};

describe('M2 Scoring, Flagging, Feedback Gating & CSV Sanitization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates custom scoringWeights sum === 100', () => {
    expect(
      scoringWeightsSchema.safeParse({
        documentCompleteness: 40,
        hazardIdentification: 30,
        procedureCompliance: 20,
        additionalPermitsAndIsolation: 10,
      }).success,
    ).toBe(true);

    expect(
      scoringWeightsSchema.safeParse({
        documentCompleteness: 50,
        hazardIdentification: 30,
        procedureCompliance: 20,
        additionalPermitsAndIsolation: 10,
      }).success,
    ).toBe(false);
  });

  it('computes 4-component score with custom weights, false-positive penalty, and floor 0', () => {
    const ogErrors = DEFAULT_MVP_SCENARIOS[0]!.seededErrors;

    const perfect = computeParticipantScore({
      participantRole: Role.APPLICANT,
      seededErrors: ogErrors,
      participantFlags: [
        { fieldPath: 'ptw.add_hot_work' },
        { fieldPath: 'additional.HOT_WORK.lelReadingPercent' },
        { fieldPath: 'additional.HOT_WORK.fireWatcherAssigned' },
      ],
      allPermitFlags: [
        { fieldPath: 'ptw.add_hot_work' },
        { fieldPath: 'additional.HOT_WORK.lelReadingPercent' },
        { fieldPath: 'additional.HOT_WORK.fireWatcherAssigned' },
      ],
      ptwCompletenessPct: 100,
      hasJsaWithSteps: true,
      additionalPermits: [{ status: AdditionalPermitStatus.APPROVED }],
      transitions: [
        { fromStatus: PermitStatus.DRAFT, toStatus: PermitStatus.SUBMITTED, actorRole: Role.APPLICANT },
      ],
    });

    expect(perfect.totalScore).toBe(100);
    expect(perfect.breakdown.missedErrorIds).toEqual([]);
    expect(perfect.breakdown.falsePositiveCount).toBe(0);

    // Many false positives floor each component at 0 (never negative)
    const penalized = computeParticipantScore({
      participantRole: Role.APPLICANT,
      seededErrors: ogErrors,
      participantFlags: Array.from({ length: 15 }, () => ({ fieldPath: 'ptw.companyName' })),
      allPermitFlags: [],
      ptwCompletenessPct: 20,
      hasJsaWithSteps: false,
      additionalPermits: [{ status: AdditionalPermitStatus.DRAFT }],
      transitions: [],
    });

    expect(penalized.totalScore).toBe(0);
    expect(penalized.breakdown.documentCompleteness).toBe(0);
    expect(penalized.breakdown.hazardIdentification).toBe(0);
    expect(penalized.breakdown.procedureCompliance).toBe(0);
    expect(penalized.breakdown.additionalPermitsAndIsolation).toBe(0);
  });

  it('penalizes SUPERVISOR/ISSUER procedure score when approving/issuing unflagged CRITICAL errors', () => {
    const ogErrors = DEFAULT_MVP_SCENARIOS[0]!.seededErrors; // has 2 CRITICAL errors
    const sup = computeParticipantScore({
      participantRole: Role.SUPERVISOR,
      seededErrors: ogErrors,
      participantFlags: [],
      allPermitFlags: [],
      ptwCompletenessPct: 100,
      hasJsaWithSteps: true,
      additionalPermits: [],
      transitions: [
        {
          fromStatus: PermitStatus.SUBMITTED,
          toStatus: PermitStatus.PENDING_ISSUANCE,
          actorRole: Role.SUPERVISOR,
        },
      ],
    });
    expect(sup.breakdown.procedureCompliance).toBe(40); // 100 - 2*30
  });

  it('hides feedback before finalize and reveals it after finalize', async () => {
    const basePermit = {
      id: 'perm-1',
      tenantId: 'tenant-1',
      errorFlags: [
        {
          id: 'f1',
          participantId: 'part-1',
          fieldPath: 'ptw.add_hot_work',
          reason: 'Kerja panas wajib dipilih pada formulir PTW',
          at: new Date(),
        },
      ],
      session: {
        id: 'sess-1',
        instructorId: 'inst-1',
        status: SessionStatus.ACTIVE,
        scenario: { seededErrorsJson: DEFAULT_MVP_SCENARIOS[0]!.seededErrors },
        participants: [
          {
            id: 'part-1',
            userId: 'u-app',
            simulatedRole: Role.APPLICANT,
            finalizedAt: null as Date | null,
          },
        ],
        scores: [{ participantId: 'part-1', totalScore: 85, breakdownJson: {} }],
      },
    };

    vi.spyOn(prisma.permit, 'findUnique').mockResolvedValue(basePermit as never);
    const beforeFinalize = await getPermitFlagsAndFeedback(applicantUser, 'perm-1');
    expect(beforeFinalize.unlocked).toBe(false);
    expect('feedback' in beforeFinalize).toBe(false);

    basePermit.session.participants[0]!.finalizedAt = new Date();
    const afterFinalize = await getPermitFlagsAndFeedback(applicantUser, 'perm-1');
    expect(afterFinalize.unlocked).toBe(true);
    expect(afterFinalize.feedback?.foundErrors.length).toBe(1);
    expect(afterFinalize.feedback?.totalScore).toBe(85);
  });

  it('enforces flag validation: unknown fieldPath, short reason, max 50 flags, locked after finalize', async () => {
    vi.spyOn(prisma.permit, 'findUnique').mockResolvedValue({
      id: 'perm-1',
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      errorFlags: [],
      session: {
        status: SessionStatus.ACTIVE,
        scenario: { seededErrorsJson: [] },
        participants: [{ id: 'part-1', userId: 'u-app', finalizedAt: null }],
      },
    } as never);

    await expect(
      flagPermitError(applicantUser, 'perm-1', {
        fieldPath: 'ptw.unknown_field',
        reason: 'Alasan cukup panjang lebih dari sepuluh karakter',
      }),
    ).rejects.toMatchObject({ statusCode: 422 });

    await expect(
      flagPermitError(applicantUser, 'perm-1', {
        fieldPath: 'ptw.add_hot_work',
        reason: 'pendek',
      }),
    ).rejects.toMatchObject({ statusCode: 422 });

    vi.spyOn(prisma.permit, 'findUnique').mockResolvedValue({
      id: 'perm-1',
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      errorFlags: Array.from({ length: MAX_FLAGS_PER_PERMIT }, (_, i) => ({ id: String(i) })),
      session: {
        status: SessionStatus.ACTIVE,
        scenario: { seededErrorsJson: [] },
        participants: [{ id: 'part-1', userId: 'u-app', finalizedAt: null }],
      },
    } as never);

    await expect(
      flagPermitError(applicantUser, 'perm-1', {
        fieldPath: 'ptw.add_hot_work',
        reason: 'Alasan cukup panjang lebih dari sepuluh karakter',
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('sanitizes CSV cells against formula injection', () => {
    expect(sanitizeCsvCell('=CMD|"/C calc"!A0')).toBe(`"'=CMD|""/C calc""!A0"`);
    expect(sanitizeCsvCell('+1+1')).toBe(`"'+1+1"`);
    expect(sanitizeCsvCell('-2+3')).toBe(`"'-2+3"`);
    expect(sanitizeCsvCell('@SUM(A1:A2)')).toBe(`"'@SUM(A1:A2)"`);
    expect(sanitizeCsvCell('Normal text')).toBe(`"Normal text"`);
  });
});
