import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import {
  PERMIT_TRANSITIONS,
  createPermitStateMachine,
  getAllowedTargetStatuses,
  validatePermitTransition,
  type PermitTransitionContext,
} from '@/lib/permit-state-machine';

const baseValidFrom = new Date('2026-11-17T08:00:00.000Z');
const baseValidTo = new Date('2026-11-17T17:00:00.000Z');
const withinValidity = new Date('2026-11-17T10:00:00.000Z');
const afterValidity = new Date('2026-11-17T18:00:00.000Z');

function makeFullContext(overrides: Partial<PermitTransitionContext> = {}): PermitTransitionContext {
  return {
    now: withinValidity,
    validFrom: baseValidFrom,
    validTo: baseValidTo,
    comment: 'Kondisi aman dan telah diverifikasi bersama tim K3.',
    allRequiredFieldsFilled: true,
    hasJsa: true,
    additionalPermitsCreated: true,
    hasApplicantSignature: true,
    reviewCompletedWithMethodAndImpactNotes: true,
    revisionSaved: true,
    hasIssuerSignature: true,
    allAdditionalPermitsApproved: true,
    workplacePrepChecklistDone: true,
    postWorkInspectionDone: true,
    verifiedAndArchived: true,
    ...overrides,
  };
}

describe('Permit State Machine (PRD Section 5)', () => {
  it('validates every legal transition in PERMIT_TRANSITIONS', () => {
    for (const rule of PERMIT_TRANSITIONS) {
      const ctx =
        rule.to === 'EXPIRED'
          ? makeFullContext({ now: afterValidity })
          : makeFullContext();

      const result = validatePermitTransition({
        from: rule.from,
        to: rule.to,
        actor: rule.actor,
        context: ctx,
      });

      expect(result.allowed, `Expected ${rule.from} -> ${rule.to} by ${rule.actor} to pass`).toBe(
        true,
      );

      // Also verify XState machine derived from the same table transitions cleanly
      const machine = createPermitStateMachine(rule.from);
      const actor = createActor(machine).start();
      actor.send({
        type: 'TRANSITION',
        to: rule.to,
        actor: rule.actor,
        context: ctx,
      });
      expect(actor.getSnapshot().value).toBe(rule.to);
    }
  });

  it('rejects illegal state jumps such as DRAFT -> APPROVED or CLOSED -> ACTIVE', () => {
    const draftToApproved = validatePermitTransition({
      from: 'DRAFT',
      to: 'APPROVED',
      actor: 'ISSUER',
      context: makeFullContext(),
    });
    expect(draftToApproved.allowed).toBe(false);

    const closedToActive = validatePermitTransition({
      from: 'CLOSED',
      to: 'ACTIVE',
      actor: 'ISSUER',
      context: makeFullContext(),
    });
    expect(closedToActive.allowed).toBe(false);
  });

  it('rejects transitions attempted by the wrong role', () => {
    const applicantApproving = validatePermitTransition({
      from: 'SUBMITTED',
      to: 'PENDING_ISSUANCE',
      actor: 'APPLICANT',
      context: makeFullContext(),
    });
    expect(applicantApproving.allowed).toBe(false);

    const userExpiringPermit = validatePermitTransition({
      from: 'ACTIVE',
      to: 'EXPIRED',
      actor: 'ISSUER',
      context: makeFullContext({ now: afterValidity }),
    });
    expect(userExpiringPermit.allowed).toBe(false);
  });

  it('rejects DRAFT -> SUBMITTED when JSA or additional permits or signature are missing', () => {
    expect(
      validatePermitTransition({
        from: 'DRAFT',
        to: 'SUBMITTED',
        actor: 'APPLICANT',
        context: makeFullContext({ hasJsa: false }),
      }).allowed,
    ).toBe(false);

    expect(
      validatePermitTransition({
        from: 'DRAFT',
        to: 'SUBMITTED',
        actor: 'APPLICANT',
        context: makeFullContext({ additionalPermitsCreated: false }),
      }).allowed,
    ).toBe(false);

    expect(
      validatePermitTransition({
        from: 'DRAFT',
        to: 'SUBMITTED',
        actor: 'APPLICANT',
        context: makeFullContext({ hasApplicantSignature: false }),
      }).allowed,
    ).toBe(false);
  });

  it('requires mandatory comments for RETURNED, REJECTED, and SUSPENDED', () => {
    expect(
      validatePermitTransition({
        from: 'SUBMITTED',
        to: 'RETURNED',
        actor: 'SUPERVISOR',
        context: makeFullContext({ comment: '   ' }),
      }).allowed,
    ).toBe(false);

    expect(
      validatePermitTransition({
        from: 'PENDING_ISSUANCE',
        to: 'REJECTED',
        actor: 'ISSUER',
        context: makeFullContext({ comment: '' }),
      }).allowed,
    ).toBe(false);

    expect(
      validatePermitTransition({
        from: 'ACTIVE',
        to: 'SUSPENDED',
        actor: 'ISSUER',
        context: makeFullContext({ comment: undefined }),
      }).allowed,
    ).toBe(false);
  });

  it('enforces SUSPENDED -> ACTIVE guard: >= 10 char comment and now < validTo', () => {
    const shortComment = validatePermitTransition({
      from: 'SUSPENDED',
      to: 'ACTIVE',
      actor: 'ISSUER',
      context: makeFullContext({ comment: 'Aman' }),
    });
    expect(shortComment.allowed).toBe(false);

    const expiredValidity = validatePermitTransition({
      from: 'SUSPENDED',
      to: 'ACTIVE',
      actor: 'ISSUER',
      context: makeFullContext({
        now: baseValidTo,
        comment: 'Kondisi sudah dipulihkan dan aman',
      }),
    });
    expect(expiredValidity.allowed).toBe(false);

    // When validTo has passed, SYSTEM must transition SUSPENDED -> EXPIRED
    const systemExpire = validatePermitTransition({
      from: 'SUSPENDED',
      to: 'EXPIRED',
      actor: 'SYSTEM',
      context: makeFullContext({ now: baseValidTo }),
    });
    expect(systemExpire.allowed).toBe(true);
  });

  it('returns allowed target statuses per role', () => {
    expect(getAllowedTargetStatuses('SUBMITTED', 'SUPERVISOR')).toEqual([
      'PENDING_ISSUANCE',
      'RETURNED',
      'REJECTED',
    ]);
    expect(getAllowedTargetStatuses('SUBMITTED', 'APPLICANT')).toEqual([]);
  });
});
