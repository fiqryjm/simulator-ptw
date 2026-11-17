import { createMachine } from 'xstate';

export const PERMIT_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_ISSUANCE',
  'APPROVED',
  'ACTIVE',
  'COMPLETED',
  'CLOSED',
  'RETURNED',
  'REJECTED',
  'SUSPENDED',
  'EXPIRED',
] as const;

export type PermitStatus = (typeof PERMIT_STATUSES)[number];

export const PERMIT_USER_ACTORS = ['APPLICANT', 'SUPERVISOR', 'ISSUER'] as const;
export type PermitActor = (typeof PERMIT_USER_ACTORS)[number] | 'SYSTEM';

export interface PermitTransitionContext {
  now: Date;
  validFrom: Date;
  validTo: Date;
  comment?: string;
  allRequiredFieldsFilled?: boolean;
  hasJsa?: boolean;
  additionalPermitsCreated?: boolean;
  hasApplicantSignature?: boolean;
  reviewCompletedWithMethodAndImpactNotes?: boolean;
  revisionSaved?: boolean;
  hasIssuerSignature?: boolean;
  allAdditionalPermitsApproved?: boolean;
  workplacePrepChecklistDone?: boolean;
  postWorkInspectionDone?: boolean;
  verifiedAndArchived?: boolean;
}

export interface PermitTransitionRule {
  readonly from: PermitStatus;
  readonly to: PermitStatus;
  readonly actor: PermitActor;
  readonly description: string;
  readonly guard: (ctx: PermitTransitionContext) => { ok: boolean; reason?: string };
}

const hasNonEmptyComment = (comment?: string, minLength = 1): boolean =>
  typeof comment === 'string' && comment.trim().length >= minLength;

/**
 * Single source of truth for all allowed PTW status transitions (PRD Section 5).
 * Both the XState machine and server-side validation are derived directly from this table.
 */
export const PERMIT_TRANSITIONS: readonly PermitTransitionRule[] = [
  {
    from: 'DRAFT',
    to: 'SUBMITTED',
    actor: 'APPLICANT',
    description: 'Pemohon mengajukan PTW awal',
    guard: (ctx) => {
      if (!ctx.allRequiredFieldsFilled) {
        return { ok: false, reason: 'Semua field wajib PTW harus terisi' };
      }
      if (!ctx.hasJsa) {
        return { ok: false, reason: 'JSA harus dilampirkan' };
      }
      if (!ctx.additionalPermitsCreated) {
        return { ok: false, reason: 'Izin tambahan wajib dibuat untuk setiap jawaban Ya' };
      }
      if (!ctx.hasApplicantSignature) {
        return { ok: false, reason: 'Tanda tangan penerima izin diperlukan' };
      }
      return { ok: true };
    },
  },
  {
    from: 'SUBMITTED',
    to: 'PENDING_ISSUANCE',
    actor: 'SUPERVISOR',
    description: 'Pengawas menyetujui review dengan catatan metode dan dampak',
    guard: (ctx) =>
      ctx.reviewCompletedWithMethodAndImpactNotes
        ? { ok: true }
        : { ok: false, reason: 'Review harus disertai catatan metode dan dampak ke aktivitas lain' },
  },
  {
    from: 'SUBMITTED',
    to: 'RETURNED',
    actor: 'SUPERVISOR',
    description: 'Pengawas mengembalikan izin untuk perbaikan',
    guard: (ctx) =>
      hasNonEmptyComment(ctx.comment)
        ? { ok: true }
        : { ok: false, reason: 'Komentar wajib diisi saat mengembalikan izin' },
  },
  {
    from: 'SUBMITTED',
    to: 'REJECTED',
    actor: 'SUPERVISOR',
    description: 'Pengawas menolak pengajuan izin',
    guard: (ctx) =>
      hasNonEmptyComment(ctx.comment)
        ? { ok: true }
        : { ok: false, reason: 'Alasan wajib diisi saat menolak izin' },
  },
  {
    from: 'RETURNED',
    to: 'SUBMITTED',
    actor: 'APPLICANT',
    description: 'Pemohon mengajukan ulang setelah perbaikan',
    guard: (ctx) => {
      if (!ctx.revisionSaved) {
        return { ok: false, reason: 'Riwayat versi perbaikan harus tersimpan' };
      }
      if (!ctx.allRequiredFieldsFilled) {
        return { ok: false, reason: 'Semua field wajib PTW harus terisi' };
      }
      if (!ctx.hasJsa) {
        return { ok: false, reason: 'JSA harus dilampirkan' };
      }
      if (!ctx.additionalPermitsCreated) {
        return { ok: false, reason: 'Izin tambahan wajib dibuat untuk setiap jawaban Ya' };
      }
      if (!ctx.hasApplicantSignature) {
        return { ok: false, reason: 'Tanda tangan penerima izin diperlukan' };
      }
      return { ok: true };
    },
  },
  {
    from: 'PENDING_ISSUANCE',
    to: 'APPROVED',
    actor: 'ISSUER',
    description: 'Pemberi izin menerbitkan izin',
    guard: (ctx) => {
      if (!ctx.hasIssuerSignature) {
        return { ok: false, reason: 'Tanda tangan pemberi izin diperlukan' };
      }
      if (!ctx.allAdditionalPermitsApproved) {
        return { ok: false, reason: 'Seluruh izin tambahan harus berstatus disetujui' };
      }
      return { ok: true };
    },
  },
  {
    from: 'PENDING_ISSUANCE',
    to: 'RETURNED',
    actor: 'ISSUER',
    description: 'Pemberi izin mengembalikan izin untuk perbaikan',
    guard: (ctx) =>
      hasNonEmptyComment(ctx.comment)
        ? { ok: true }
        : { ok: false, reason: 'Alasan wajib diisi saat mengembalikan izin' },
  },
  {
    from: 'PENDING_ISSUANCE',
    to: 'REJECTED',
    actor: 'ISSUER',
    description: 'Pemberi izin menolak penerbitan izin',
    guard: (ctx) =>
      hasNonEmptyComment(ctx.comment)
        ? { ok: true }
        : { ok: false, reason: 'Alasan wajib diisi saat menolak izin' },
  },
  {
    from: 'APPROVED',
    to: 'ACTIVE',
    actor: 'APPLICANT',
    description: 'Pemohon memulai pekerjaan setelah persiapan tempat kerja',
    guard: (ctx) => {
      if (!ctx.workplacePrepChecklistDone) {
        return { ok: false, reason: 'Daftar periksa persiapan tempat kerja harus selesai' };
      }
      if (ctx.now < ctx.validFrom || ctx.now > ctx.validTo) {
        return { ok: false, reason: 'Waktu sekarang harus berada dalam periode berlaku izin' };
      }
      return { ok: true };
    },
  },
  {
    from: 'ACTIVE',
    to: 'SUSPENDED',
    actor: 'ISSUER',
    description: 'Pemberi izin menangguhkan izin sementara',
    guard: (ctx) =>
      hasNonEmptyComment(ctx.comment)
        ? { ok: true }
        : { ok: false, reason: 'Alasan wajib diisi saat menangguhkan izin' },
  },
  {
    from: 'SUSPENDED',
    to: 'ACTIVE',
    actor: 'ISSUER',
    description: 'Pemberi izin mengaktifkan kembali izin yang ditangguhkan',
    guard: (ctx) => {
      if (!hasNonEmptyComment(ctx.comment, 10)) {
        return {
          ok: false,
          reason: 'Catatan pemulihan wajib diisi minimal 10 karakter',
        };
      }
      if (ctx.now >= ctx.validTo) {
        return {
          ok: false,
          reason: 'Waktu berlaku izin sudah lewat; izin harus menjadi EXPIRED, bukan ACTIVE',
        };
      }
      return { ok: true };
    },
  },
  {
    from: 'ACTIVE',
    to: 'COMPLETED',
    actor: 'APPLICANT',
    description: 'Pemohon menyelesaikan pekerjaan dan pemeriksaan lokasi',
    guard: (ctx) =>
      ctx.postWorkInspectionDone
        ? { ok: true }
        : { ok: false, reason: 'Pemeriksaan lokasi pasca-pekerjaan harus selesai' },
  },
  {
    from: 'COMPLETED',
    to: 'CLOSED',
    actor: 'ISSUER',
    description: 'Pemberi izin memverifikasi penutupan dan mengarsipkan',
    guard: (ctx) =>
      ctx.verifiedAndArchived
        ? { ok: true }
        : { ok: false, reason: 'Verifikasi penutupan dan pengarsipan diperlukan' },
  },
  {
    from: 'APPROVED',
    to: 'EXPIRED',
    actor: 'SYSTEM',
    description: 'Sistem menandai izin kedaluwarsa karena melewati waktu berlaku',
    guard: (ctx) =>
      ctx.now > ctx.validTo
        ? { ok: true }
        : { ok: false, reason: 'Waktu berlaku izin belum terlewati' },
  },
  {
    from: 'ACTIVE',
    to: 'EXPIRED',
    actor: 'SYSTEM',
    description: 'Sistem menandai izin aktif kedaluwarsa karena melewati waktu berlaku',
    guard: (ctx) =>
      ctx.now > ctx.validTo
        ? { ok: true }
        : { ok: false, reason: 'Waktu berlaku izin belum terlewati' },
  },
  {
    from: 'SUSPENDED',
    to: 'EXPIRED',
    actor: 'SYSTEM',
    description: 'Sistem menandai izin ditangguhkan kedaluwarsa karena melewati waktu berlaku',
    guard: (ctx) =>
      ctx.now >= ctx.validTo
        ? { ok: true }
        : { ok: false, reason: 'Waktu berlaku izin belum terlewati' },
  },
] as const;

export interface TransitionValidationInput {
  from: PermitStatus;
  to: PermitStatus;
  actor: string;
  context: PermitTransitionContext;
}

export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
  rule?: PermitTransitionRule;
}

/**
 * Validates a PTW status transition against the single-source-of-truth table.
 */
export function validatePermitTransition(
  input: TransitionValidationInput,
): TransitionValidationResult {
  const candidates = PERMIT_TRANSITIONS.filter(
    (rule) => rule.from === input.from && rule.to === input.to,
  );

  if (candidates.length === 0) {
    return {
      allowed: false,
      reason: `Transisi dari ${input.from} ke ${input.to} tidak diizinkan`,
    };
  }

  const matchedRule = candidates.find((rule) => rule.actor === input.actor);
  if (!matchedRule) {
    return {
      allowed: false,
      reason: `Peran ${input.actor} tidak berwenang melakukan transisi ${input.from} -> ${input.to}`,
    };
  }

  const guardResult = matchedRule.guard(input.context);
  if (!guardResult.ok) {
    return {
      allowed: false,
      reason: guardResult.reason ?? 'Syarat transisi tidak terpenuhi',
    };
  }

  return {
    allowed: true,
    rule: matchedRule,
  };
}

/**
 * Returns all possible target statuses from a given status for a specific actor.
 */
export function getAllowedTargetStatuses(
  from: PermitStatus,
  actor: PermitActor,
): PermitStatus[] {
  return PERMIT_TRANSITIONS.filter((rule) => rule.from === from && rule.actor === actor).map(
    (rule) => rule.to,
  );
}

export interface PermitMachineEvent {
  type: 'TRANSITION';
  to: PermitStatus;
  actor: PermitActor;
  context: PermitTransitionContext;
}

type XStateStatesConfig = Record<
  PermitStatus,
  {
    on?: {
      TRANSITION: Array<{
        target: PermitStatus;
        guard: ({ event }: { event: PermitMachineEvent }) => boolean;
      }>;
    };
  }
>;

function buildStatesFromTransitionTable(): XStateStatesConfig {
  const states = {} as XStateStatesConfig;

  for (const status of PERMIT_STATUSES) {
    const outgoing = PERMIT_TRANSITIONS.filter((rule) => rule.from === status);
    if (outgoing.length === 0) {
      states[status] = {};
      continue;
    }

    states[status] = {
      on: {
        TRANSITION: outgoing.map((rule) => ({
          target: rule.to,
          guard: ({ event }: { event: PermitMachineEvent }) => {
            if (event.to !== rule.to || event.actor !== rule.actor) {
              return false;
            }
            return rule.guard(event.context).ok;
          },
        })),
      },
    };
  }

  return states;
}

/**
 * Creates an XState v5 machine derived directly from PERMIT_TRANSITIONS.
 */
export function createPermitStateMachine(initialStatus: PermitStatus = 'DRAFT') {
  return createMachine({
    id: 'permit',
    initial: initialStatus,
    types: {} as {
      events: PermitMachineEvent;
    },
    states: buildStatesFromTransitionTable(),
  });
}
