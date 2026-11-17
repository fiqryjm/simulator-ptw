import { AdditionalPermitStatus, PermitStatus, Role, SessionStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scoringWeightsSchema } from '@/lib/datetime';
import { prisma } from '@/lib/prisma';
import type { SessionUser } from '@/lib/rbac';
import { DEFAULT_MVP_SCENARIOS } from '@/modules/scenario/default-scenarios';
import { evaluateUnfixedCriticalErrors } from '@/modules/scenario/service';
import {
  computeParticipantScore,
  exportSessionScoresCsv,
  finalizeParticipantSession,
  flagPermitError,
  getPermitFlagsAndFeedback,
  MAX_FLAGS_PER_PERMIT,
  recalculateSessionScores,
  sanitizeCsvCell,
} from '@/modules/scoring/service';

const applicantUser: SessionUser = {
  id: 'u-app',
  email: 'app@demo.ptw.local',
  name: 'Applicant',
  role: Role.APPLICANT,
  tenantId: 'tenant-1',
};

describe('M2/D-45 Scoring, Flagging, Feedback Gating & CSV Sanitization', () => {
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
      participantUserId: 'u-app',
      participantRole: Role.APPLICANT,
      seededErrors: ogErrors,
      participantFlags: [
        { fieldPath: 'ptw.add_hot_work' },
        { fieldPath: 'additional.HOT_WORK.lelReadingPercent' },
        { fieldPath: 'additional.HOT_WORK.fireWatcherAssigned' },
      ],
      ptwCompletenessPct: 100,
      additionalPermits: [{ status: AdditionalPermitStatus.APPROVED }],
      transitions: [
        {
          fromStatus: PermitStatus.DRAFT,
          toStatus: PermitStatus.SUBMITTED,
          actorId: 'u-app',
          actorRole: Role.APPLICANT,
          at: new Date('2026-11-17T09:00:00Z'),
        },
      ],
    });

    expect(perfect.totalScore).toBe(100);
    expect(perfect.breakdown.missedErrorIds).toEqual([]);
    expect(perfect.breakdown.falsePositiveCount).toBe(0);

    const penalized = computeParticipantScore({
      participantUserId: 'u-app',
      participantRole: Role.APPLICANT,
      seededErrors: ogErrors,
      participantFlags: Array.from({ length: 15 }, () => ({ fieldPath: 'ptw.companyName' })),
      ptwCompletenessPct: 20,
      additionalPermits: [{ status: AdditionalPermitStatus.DRAFT }],
      transitions: [],
    });

    expect(penalized.totalScore).toBe(0);
    expect(penalized.breakdown.documentCompleteness).toBe(0);
    expect(penalized.breakdown.hazardIdentification).toBe(0);
    expect(penalized.breakdown.procedureCompliance).toBe(0);
    expect(penalized.breakdown.additionalPermitsAndIsolation).toBe(0);
  });

  it('D-45.1: preserves historical procedure score by Transition.actorId even after role swap', () => {
    const ogErrors = DEFAULT_MVP_SCENARIOS[0]!.seededErrors;
    const transitions = [
      {
        fromStatus: PermitStatus.DRAFT,
        toStatus: PermitStatus.SUBMITTED,
        actorId: 'u-1',
        actorRole: Role.APPLICANT,
        at: new Date('2026-11-17T09:00:00Z'),
      },
      {
        fromStatus: PermitStatus.SUBMITTED,
        toStatus: PermitStatus.RETURNED,
        actorId: 'u-sup',
        actorRole: Role.SUPERVISOR,
        at: new Date('2026-11-17T09:05:00Z'),
      },
    ];

    const beforeSwap = computeParticipantScore({
      participantUserId: 'u-1',
      participantRole: Role.APPLICANT,
      seededErrors: ogErrors,
      participantFlags: [],
      ptwCompletenessPct: 100,
      additionalPermits: [{ status: AdditionalPermitStatus.APPROVED }],
      transitions,
    });

    // User u-1 is later swapped to COORDINATOR, but their historical APPLICANT transition score (90) remains intact
    const afterSwap = computeParticipantScore({
      participantUserId: 'u-1',
      participantRole: Role.COORDINATOR,
      seededErrors: ogErrors,
      participantFlags: [],
      ptwCompletenessPct: 100,
      additionalPermits: [{ status: AdditionalPermitStatus.APPROVED }],
      transitions,
    });

    expect(beforeSwap.breakdown.procedureCompliance).toBe(90);
    expect(afterSwap.breakdown.procedureCompliance).toBe(90);
  });

  it('D-45.2: excludes components without relevant seededErrors and re-normalizes remaining weights', () => {
    // Only 1 seededError in PROCEDURE (no COMPLETENESS, no HAZARD, no ADDITIONAL) for SUPERVISOR
    const res = computeParticipantScore({
      participantUserId: 'u-sup',
      participantRole: Role.SUPERVISOR,
      seededErrors: [],
      participantFlags: [],
      ptwCompletenessPct: 100,
      additionalPermits: [],
      transitions: [
        {
          fromStatus: PermitStatus.SUBMITTED,
          toStatus: PermitStatus.PENDING_ISSUANCE,
          actorId: 'u-sup',
          actorRole: Role.SUPERVISOR,
          payloadJson: { unfixedCriticalErrorIds: [] },
        },
      ],
    });

    expect(res.breakdown.documentCompleteness).toBeNull();
    expect(res.breakdown.hazardIdentification).toBeNull();
    expect(res.breakdown.additionalPermitsAndIsolation).toBeNull();
    expect(res.breakdown.procedureCompliance).toBe(100);
    expect(res.breakdown.applicableComponents).toEqual(['PROCEDURE']);
    expect(res.totalScore).toBe(100);

    // When all components are empty (e.g., INSTRUCTOR or non-procedural role with no errors), totalScore is 0
    const emptyRes = computeParticipantScore({
      participantUserId: 'u-inst',
      participantRole: Role.INSTRUCTOR,
      seededErrors: [],
      participantFlags: [],
      ptwCompletenessPct: 100,
      additionalPermits: [],
      transitions: [],
    });
    expect(emptyRes.breakdown.applicableComponents).toEqual([]);
    expect(emptyRes.totalScore).toBe(0);
  });

  it('D-45.3: scores COORDINATOR procedure compliance from SupervisionNotes during ACTIVE window', () => {
    const transitions = [
      {
        fromStatus: PermitStatus.APPROVED,
        toStatus: PermitStatus.ACTIVE,
        actorId: 'u-app',
        actorRole: Role.APPLICANT,
        at: new Date('2026-11-17T10:00:00Z'),
      },
      {
        fromStatus: PermitStatus.ACTIVE,
        toStatus: PermitStatus.COMPLETED,
        actorId: 'u-app',
        actorRole: Role.APPLICANT,
        at: new Date('2026-11-17T12:00:00Z'),
      },
    ];

    const noNotes = computeParticipantScore({
      participantUserId: 'u-coord',
      participantRole: Role.COORDINATOR,
      seededErrors: [],
      participantFlags: [],
      ptwCompletenessPct: 100,
      additionalPermits: [],
      transitions,
      supervisionNotes: [],
    });
    expect(noNotes.breakdown.procedureCompliance).toBe(0);

    const withActiveNote = computeParticipantScore({
      participantUserId: 'u-coord',
      participantRole: Role.COORDINATOR,
      seededErrors: [],
      participantFlags: [],
      ptwCompletenessPct: 100,
      additionalPermits: [],
      transitions,
      supervisionNotes: [{ authorId: 'u-coord', at: new Date('2026-11-17T11:00:00Z') }],
    });
    expect(withActiveNote.breakdown.procedureCompliance).toBe(100);
  });

  it('D-45.4: penalizes SUPERVISOR/ISSUER when CRITICAL error is flagged but NOT fixed in permit data', () => {
    const ogErrors = DEFAULT_MVP_SCENARIOS[0]!.seededErrors; // 2 CRITICAL errors

    // Scenario data still unfixed at moment of approval
    const unfixedIds = evaluateUnfixedCriticalErrors(ogErrors, {
      ptwData: { add_hot_work: 'NO' },
      additionalPermits: [],
      jsaData: undefined,
    });
    expect(unfixedIds).toHaveLength(2);

    // Even if participant flagged both errors, SUPERVISOR still gets -60 penalty because data wasn't fixed!
    const sup = computeParticipantScore({
      participantUserId: 'u-sup',
      participantRole: Role.SUPERVISOR,
      seededErrors: ogErrors,
      participantFlags: [
        { fieldPath: 'ptw.add_hot_work' },
        { fieldPath: 'additional.HOT_WORK.lelReadingPercent' },
      ],
      ptwCompletenessPct: 100,
      additionalPermits: [],
      transitions: [
        {
          fromStatus: PermitStatus.SUBMITTED,
          toStatus: PermitStatus.PENDING_ISSUANCE,
          actorId: 'u-sup',
          actorRole: Role.SUPERVISOR,
          payloadJson: { unfixedCriticalErrorIds: unfixedIds },
        },
      ],
    });
    expect(sup.breakdown.procedureCompliance).toBe(40); // 100 - 2*30

    // Once fixed in live permit & additional permit data, unfixedCriticalErrorIds is empty -> 100
    const fixedIds = evaluateUnfixedCriticalErrors(ogErrors, {
      ptwData: { add_hot_work: 'YES' },
      additionalPermits: [{ type: 'HOT_WORK', dataJson: { lelReadingPercent: 0 } }],
      jsaData: undefined,
    });
    expect(fixedIds).toHaveLength(0);
  });

  it('D-46: ignores flags matching seededErrors irrelevant to participant roles (no penalty, no points)', () => {
    const ogErrors = DEFAULT_MVP_SCENARIOS[0]!.seededErrors;
    // err_og_fire_watcher has relevantRoles: [APPLICANT, SUPERVISOR, ISSUER, COORDINATOR]
    // Create an error only relevant to ISSUER
    const issuerOnlyError = {
      ...ogErrors[0]!,
      id: 'err_issuer_only',
      relevantRoles: [Role.ISSUER],
    };

    const res = computeParticipantScore({
      participantUserId: 'u-coord',
      participantRole: Role.COORDINATOR,
      seededErrors: [issuerOnlyError],
      participantFlags: [{ fieldPath: issuerOnlyError.fieldPath }],
      ptwCompletenessPct: 100,
      additionalPermits: [],
      transitions: [],
      supervisionNotes: [],
    });

    expect(res.breakdown.falsePositiveCount).toBe(0);
    expect(res.breakdown.matchedErrorIds).toEqual([]);
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

  it('enforces flag validation, finalizeParticipantSession, recalculateSessionScores & CSV export', async () => {
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

    // Test finalizeParticipantSession + recalculateSessionScores
    vi.spyOn(prisma.session, 'findUnique').mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-1',
      tenant: { settings: {} },
      scenario: { seededErrorsJson: [] },
      participants: [{ id: 'part-1', userId: 'u-app', simulatedRole: Role.APPLICANT, finalizedAt: null }],
      permits: [
        {
          id: 'perm-1',
          dataJson: {},
          additionalPermits: [],
          jsaRecords: [],
          transitions: [],
          supervisionNotes: [],
          errorFlags: [],
        },
      ],
    } as never);
    vi.spyOn(prisma.participant, 'update').mockResolvedValue({ id: 'part-1' } as never);
    vi.spyOn(prisma.score, 'upsert').mockResolvedValue({ id: 'score-1' } as never);

    await expect(finalizeParticipantSession(applicantUser, 'sess-1')).resolves.toEqual({
      finalized: true,
    });
    await recalculateSessionScores('sess-1');

    // Test CSV export + injection sanitization
    const instructor: SessionUser = {
      id: 'inst-1',
      email: 'inst@demo.ptw.local',
      name: 'Inst',
      role: Role.INSTRUCTOR,
      tenantId: 'tenant-1',
    };
    vi.spyOn(prisma.session, 'findUnique').mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-1',
      instructorId: 'inst-1',
      joinCode: 'ABC234',
      scenario: { title: 'Test' },
      participants: [
        {
          user: { name: 'Budi', email: 'budi@demo.ptw.local' },
          simulatedRole: Role.APPLICANT,
          finalizedAt: null,
          scores: [{ sessionId: 'sess-1', totalScore: 80 }],
          errorFlags: [{ fieldPath: 'ptw.add_hot_work', reason: '=CMD()' }],
        },
      ],
    } as never);
    const csv = await exportSessionScoresCsv(instructor, 'sess-1');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(sanitizeCsvCell('=CMD|"/C calc"!A0')).toBe(`"'=CMD|""/C calc""!A0"`);
    expect(sanitizeCsvCell('+1+1')).toBe(`"'+1+1"`);
    expect(sanitizeCsvCell('-2+3')).toBe(`"'-2+3"`);
    expect(sanitizeCsvCell('@SUM(A1:A2)')).toBe(`"'@SUM(A1:A2)"`);
  });
});
