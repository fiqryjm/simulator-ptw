import {
  AdditionalPermitStatus,
  AdditionalPermitType,
  FormTemplateType,
  Industry,
  PermitStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { parseDateInput, parseTenantSettings } from '@/lib/datetime';
import { validatePermitTransition } from '@/lib/permit-state-machine';
import { assertTenantAccess, getEffectiveRole, type SessionUser } from '@/lib/rbac';
import { isJsaComplete } from '@/modules/jsa/service';
import {
  DEFAULT_ADDITIONAL_PERMIT_TEMPLATES,
  DEFAULT_PTW_TEMPLATE_SCHEMA,
} from '@/modules/permit/default-templates';
import { ServiceError } from '@/modules/permit/errors';
import {
  extractTriggeredAdditionalPermits,
  flattenPtwFields,
  validateDynamicFields,
  validateLifecycleChecklist,
  type AdditionalPermitTemplateSchema,
  type PtwTemplateSchema,
} from '@/modules/permit/template-schema';
import {
  evaluateUnfixedCriticalErrors,
  parseScenarioInitialData,
  parseSeededErrors,
} from '@/modules/scenario/service';

const MAX_SIGNATURE_BYTES = 200 * 1024;
const PNG_DATA_URL_REGEX = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

export const ROLE_WAITING_STATUSES: Partial<Record<Role, PermitStatus[]>> = {
  APPLICANT: ['DRAFT', 'RETURNED', 'APPROVED', 'ACTIVE'],
  SUPERVISOR: ['SUBMITTED'],
  ISSUER: ['PENDING_ISSUANCE', 'COMPLETED', 'SUSPENDED'],
  COORDINATOR: ['ACTIVE'],
};

async function getTenantPtwTemplate(
  tenantId: string,
  industry: Industry,
): Promise<PtwTemplateSchema> {
  const tpl = await prisma.formTemplate.findFirst({
    where: { tenantId, type: FormTemplateType.PTW, industry },
    orderBy: { version: 'desc' },
  });
  if (!tpl) {
    return DEFAULT_PTW_TEMPLATE_SCHEMA;
  }
  return tpl.schemaJson as unknown as PtwTemplateSchema;
}

async function getTenantAdditionalTemplate(
  tenantId: string,
  industry: Industry,
  type: AdditionalPermitType,
): Promise<AdditionalPermitTemplateSchema | undefined> {
  const templates = await prisma.formTemplate.findMany({
    where: { tenantId, type: FormTemplateType.ADDITIONAL, industry },
    orderBy: { version: 'desc' },
  });

  for (const tpl of templates) {
    const schema = tpl.schemaJson as unknown as AdditionalPermitTemplateSchema;
    if (schema.type === type) {
      return schema;
    }
  }

  return DEFAULT_ADDITIONAL_PERMIT_TEMPLATES.find((t) => t.type === type);
}

export async function listPermitsForTenant(user: SessionUser) {
  return prisma.permit.findMany({
    where: { tenantId: user.tenantId },
    include: {
      applicant: { select: { id: true, name: true, email: true } },
      session: { select: { id: true, joinCode: true, scenario: { select: { title: true, industry: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getWaitingPermitsForUser(user: SessionUser) {
  const effectiveRole = getEffectiveRole(user);
  const statuses = ROLE_WAITING_STATUSES[effectiveRole] ?? [];
  if (statuses.length === 0) {
    return [];
  }

  return prisma.permit.findMany({
    where: {
      tenantId: user.tenantId,
      status: { in: statuses },
    },
    include: {
      applicant: { select: { id: true, name: true } },
      session: { select: { id: true, scenario: { select: { title: true, industry: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getPermitDetail(user: SessionUser, permitId: string) {
  const permit = await prisma.permit.findUnique({
    where: { id: permitId },
    include: {
      tenant: { select: { id: true, name: true, settings: true } },
      applicant: { select: { id: true, name: true, email: true } },
      session: {
        include: {
          participants: true,
          scenario: { select: { id: true, title: true, industry: true } },
        },
      },
      additionalPermits: { orderBy: { createdAt: 'asc' } },
      jsaRecords: true,
      signatures: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { signedAt: 'asc' },
      },
      transitions: { orderBy: { at: 'desc' } },
      supervisionNotes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { at: 'desc' },
      },
      versions: { orderBy: { version: 'desc' } },
    },
  });

  if (!permit) {
    throw new ServiceError(404, 'Izin tidak ditemukan');
  }

  assertTenantAccess(user, permit.tenantId);

  const ptwTemplate = await getTenantPtwTemplate(permit.tenantId, permit.session.scenario.industry);
  const additionalTemplates: Record<string, AdditionalPermitTemplateSchema> = {};
  for (const add of permit.additionalPermits) {
    const tpl = await getTenantAdditionalTemplate(
      permit.tenantId,
      permit.session.scenario.industry,
      add.type,
    );
    if (tpl) {
      additionalTemplates[add.type] = tpl;
    }
  }

  return {
    permit,
    ptwTemplate,
    additionalTemplates,
    tenantSettings: parseTenantSettings(permit.tenant.settings),
  };
}

export async function createPermit(
  user: SessionUser,
  input: { sessionId: string; dataJson?: Record<string, unknown> },
) {
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    include: { scenario: true, participants: true },
  });

  if (!session) {
    throw new ServiceError(404, 'Sesi pelatihan tidak ditemukan');
  }

  assertTenantAccess(user, session.tenantId);

  const effectiveRole = getEffectiveRole(user, session);
  if (effectiveRole !== Role.APPLICANT) {
    throw new ServiceError(403, 'Hanya APPLICANT yang dapat membuat izin kerja');
  }

  const dataJson = input.dataJson ?? {};
  const now = new Date();
  const parsedFrom = parseDateInput(dataJson.validFrom) ?? now;
  const parsedTo = parseDateInput(dataJson.validTo) ?? new Date(now.getTime() + 8 * 60 * 60 * 1000);

  if (parsedTo <= parsedFrom) {
    throw new ServiceError(422, 'Tanggal/jam selesai harus setelah tanggal/jam mulai');
  }

  const ptwTemplate = await getTenantPtwTemplate(session.tenantId, session.scenario.industry);
  const triggeredTypes = extractTriggeredAdditionalPermits(ptwTemplate, dataJson);

  return prisma.$transaction(async (tx) => {
    const permit = await tx.permit.create({
      data: {
        tenantId: session.tenantId,
        sessionId: session.id,
        applicantId: user.id,
        status: PermitStatus.DRAFT,
        dataJson: dataJson as Prisma.InputJsonValue,
        validFrom: parsedFrom,
        validTo: parsedTo,
        currentVersion: 1,
      },
    });

    for (const type of triggeredTypes) {
      await tx.additionalPermit.create({
        data: {
          tenantId: session.tenantId,
          permitId: permit.id,
          type,
          dataJson: {},
          status: AdditionalPermitStatus.DRAFT,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        actorId: user.id,
        action: 'CREATE_PERMIT',
        entity: 'Permit',
        entityId: permit.id,
      },
    });

    return permit;
  });
}

export async function updatePermitDraft(
  user: SessionUser,
  permitId: string,
  input: { expectedVersion: number; dataJson: Record<string, unknown> },
) {
  const permit = await prisma.permit.findUnique({
    where: { id: permitId },
    include: {
      session: { include: { scenario: true, participants: true } },
      additionalPermits: true,
    },
  });

  if (!permit) {
    throw new ServiceError(404, 'Izin tidak ditemukan');
  }

  assertTenantAccess(user, permit.tenantId);

  const effectiveRole = getEffectiveRole(user, permit.session);
  if (effectiveRole !== Role.APPLICANT) {
    throw new ServiceError(403, 'Hanya APPLICANT yang dapat mengubah draf PTW');
  }

  if (permit.status !== PermitStatus.DRAFT && permit.status !== PermitStatus.RETURNED) {
    throw new ServiceError(409, 'Data PTW bersifat read-only setelah diajukan');
  }

  if (permit.currentVersion !== input.expectedVersion) {
    throw new ServiceError(
      409,
      'Konflik versi: izin telah diperbarui oleh proses lain. Muat ulang halaman dan coba lagi.',
    );
  }

  const parsedFrom = parseDateInput(input.dataJson.validFrom) ?? permit.validFrom;
  const parsedTo = parseDateInput(input.dataJson.validTo) ?? permit.validTo;
  if (parsedTo <= parsedFrom) {
    throw new ServiceError(422, 'Tanggal/jam selesai harus setelah tanggal/jam mulai');
  }

  const ptwTemplate = await getTenantPtwTemplate(permit.tenantId, permit.session.scenario.industry);
  const triggeredTypes = extractTriggeredAdditionalPermits(ptwTemplate, input.dataJson);
  const existingByType = new Map(permit.additionalPermits.map((ap) => [ap.type, ap]));

  for (const existing of permit.additionalPermits) {
    if (!triggeredTypes.includes(existing.type) && existing.status !== AdditionalPermitStatus.DRAFT) {
      throw new ServiceError(
        409,
        `Izin tambahan ${existing.type} tidak dapat dihapus karena sudah berstatus ${existing.status}`,
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    // Update with optimistic lock check in where clause
    const updated = await tx.permit.updateMany({
      where: {
        id: permit.id,
        tenantId: permit.tenantId,
        currentVersion: input.expectedVersion,
      },
      data: {
        dataJson: input.dataJson as Prisma.InputJsonValue,
        validFrom: parsedFrom,
        validTo: parsedTo,
      },
    });

    if (updated.count === 0) {
      throw new ServiceError(409, 'Konflik versi saat menyimpan draf izin');
    }

    // Create newly triggered additional permits
    for (const type of triggeredTypes) {
      if (!existingByType.has(type)) {
        await tx.additionalPermit.create({
          data: {
            tenantId: permit.tenantId,
            permitId: permit.id,
            type,
            dataJson: {},
            status: AdditionalPermitStatus.DRAFT,
          },
        });
      }
    }

    // Delete DRAFT additional permits toggled to NO
    for (const existing of permit.additionalPermits) {
      if (!triggeredTypes.includes(existing.type) && existing.status === AdditionalPermitStatus.DRAFT) {
        await tx.additionalPermit.delete({ where: { id: existing.id } });
      }
    }

    return tx.permit.findUniqueOrThrow({
      where: { id: permit.id },
      include: { additionalPermits: true },
    });
  });
}

export async function updateAdditionalPermit(
  user: SessionUser,
  permitId: string,
  additionalId: string,
  input: {
    dataJson?: Record<string, unknown>;
    decision?: 'APPROVED' | 'REJECTED';
  },
) {
  const permit = await prisma.permit.findUnique({
    where: { id: permitId },
    include: {
      session: { include: { scenario: true, participants: true } },
      additionalPermits: true,
    },
  });

  if (!permit) {
    throw new ServiceError(404, 'Izin tidak ditemukan');
  }

  assertTenantAccess(user, permit.tenantId);

  const additional = permit.additionalPermits.find((ap) => ap.id === additionalId);
  if (!additional) {
    throw new ServiceError(404, 'Sub-formulir izin tambahan tidak ditemukan');
  }

  const effectiveRole = getEffectiveRole(user, permit.session);

  if (input.decision) {
    if (effectiveRole !== Role.ISSUER) {
      throw new ServiceError(403, 'Hanya ISSUER yang dapat menyetujui atau menolak izin tambahan');
    }
    if (permit.status !== PermitStatus.PENDING_ISSUANCE) {
      throw new ServiceError(
        409,
        'Persetujuan izin tambahan hanya dapat dilakukan saat izin berstatus PENDING_ISSUANCE',
      );
    }

    if (input.decision === 'APPROVED') {
      const addTemplate = await getTenantAdditionalTemplate(
        permit.tenantId,
        permit.session.scenario.industry,
        additional.type,
      );
      if (addTemplate) {
        const validation = validateDynamicFields(
          addTemplate.fields,
          (additional.dataJson as Record<string, unknown>) ?? {},
          { enforceRequired: true },
        );
        if (!validation.valid) {
          throw new ServiceError(
            422,
            'Izin tambahan tidak dapat disetujui karena field wajib belum lengkap',
            { fieldErrors: validation.errors },
          );
        }
      }
    }

    return prisma.additionalPermit.update({
      where: { id: additional.id },
      data: {
        status:
          input.decision === 'APPROVED'
            ? AdditionalPermitStatus.APPROVED
            : AdditionalPermitStatus.REJECTED,
      },
    });
  }

  // Applicant editing additional permit data
  if (effectiveRole !== Role.APPLICANT) {
    throw new ServiceError(403, 'Hanya APPLICANT yang dapat mengisi sub-formulir izin tambahan');
  }
  if (permit.status !== PermitStatus.DRAFT && permit.status !== PermitStatus.RETURNED) {
    throw new ServiceError(409, 'Sub-formulir izin tambahan bersifat read-only setelah diajukan');
  }

  const newData = input.dataJson ?? {};
  const dataChanged = JSON.stringify(additional.dataJson) !== JSON.stringify(newData);

  return prisma.additionalPermit.update({
    where: { id: additional.id },
    data: {
      dataJson: newData as Prisma.InputJsonValue,
      // When RETURNED and data changed, reset status to DRAFT so prior approval is invalidated
      status:
        permit.status === PermitStatus.RETURNED && dataChanged
          ? AdditionalPermitStatus.DRAFT
          : additional.status,
    },
  });
}

export async function savePermitSignature(
  user: SessionUser,
  permitId: string,
  input: { role: Role; imageData: string },
) {
  const permit = await prisma.permit.findUnique({
    where: { id: permitId },
    include: { session: { include: { participants: true } } },
  });

  if (!permit) {
    throw new ServiceError(404, 'Izin tidak ditemukan');
  }

  assertTenantAccess(user, permit.tenantId);

  const effectiveRole = getEffectiveRole(user, permit.session);
  if (effectiveRole !== input.role) {
    throw new ServiceError(403, 'Anda hanya boleh menandatangani untuk peran Anda sendiri');
  }

  if (input.role === Role.APPLICANT) {
    if (permit.status !== PermitStatus.DRAFT && permit.status !== PermitStatus.RETURNED) {
      throw new ServiceError(409, 'Tanda tangan pemohon hanya dapat diubah saat DRAFT atau RETURNED');
    }
  } else if (input.role === Role.ISSUER) {
    if (permit.status !== PermitStatus.PENDING_ISSUANCE) {
      throw new ServiceError(409, 'Tanda tangan pemberi izin hanya dapat dibuat saat PENDING_ISSUANCE');
    }
  } else {
    throw new ServiceError(403, 'Peran ini tidak memiliki slot tanda tangan izin');
  }

  const match = PNG_DATA_URL_REGEX.exec(input.imageData);
  if (!match || !match[1]) {
    throw new ServiceError(422, 'Format tanda tangan harus berupa PNG data URL yang valid');
  }

  const decodedBytes = Buffer.from(match[1], 'base64').byteLength;
  if (decodedBytes === 0 || decodedBytes > MAX_SIGNATURE_BYTES) {
    throw new ServiceError(422, 'Ukuran tanda tangan melebihi batas maksimum 200 KB');
  }

  const existing = await prisma.signature.findFirst({
    where: { permitId: permit.id, tenantId: permit.tenantId, role: input.role },
  });

  if (existing) {
    return prisma.signature.update({
      where: { id: existing.id },
      data: {
        userId: user.id,
        imageData: input.imageData,
        signedAt: new Date(),
      },
    });
  }

  return prisma.signature.create({
    data: {
      tenantId: permit.tenantId,
      permitId: permit.id,
      role: input.role,
      userId: user.id,
      imageData: input.imageData,
    },
  });
}

export const transitionInputSchema = z.object({
  toStatus: z.nativeEnum(PermitStatus),
  expectedVersion: z.number().int().positive(),
  comment: z.string().optional(),
  payload: z
    .object({
      checklist: z.record(z.unknown()).optional(),
      verifiedAndArchived: z.boolean().optional(),
    })
    .optional(),
});

export async function transitionPermit(
  user: SessionUser,
  permitId: string,
  rawInput: unknown,
) {
  const parsed = transitionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ServiceError(422, 'Payload transisi tidak valid', {
      issues: parsed.error.flatten(),
    });
  }

  const input = parsed.data;

  const permit = await prisma.permit.findUnique({
    where: { id: permitId },
    include: {
      session: { include: { scenario: true, participants: true } },
      additionalPermits: true,
      jsaRecords: true,
      signatures: true,
    },
  });

  if (!permit) {
    throw new ServiceError(404, 'Izin tidak ditemukan');
  }

  assertTenantAccess(user, permit.tenantId);

  if (permit.currentVersion !== input.expectedVersion) {
    throw new ServiceError(
      409,
      'Konflik versi: izin telah diubah oleh pengguna lain. Muat ulang halaman dan coba lagi.',
    );
  }

  const effectiveRole = getEffectiveRole(user, permit.session);
  const ptwTemplate = await getTenantPtwTemplate(permit.tenantId, permit.session.scenario.industry);
  const permitData = (permit.dataJson as Record<string, unknown>) ?? {};
  const now = new Date();

  const ptwFieldsValidation = validateDynamicFields(flattenPtwFields(ptwTemplate), permitData, {
    enforceRequired: true,
  });
  const triggeredTypes = extractTriggeredAdditionalPermits(ptwTemplate, permitData);
  const existingTypes = new Set(permit.additionalPermits.map((ap) => ap.type));
  const additionalPermitsCreated = triggeredTypes.every((t) => existingTypes.has(t));
  const allAdditionalPermitsApproved = permit.additionalPermits.every(
    (ap) => ap.status === AdditionalPermitStatus.APPROVED,
  );

  const hasApplicantSignature = permit.signatures.some((s) => s.role === Role.APPLICANT);
  const hasIssuerSignature = permit.signatures.some((s) => s.role === Role.ISSUER);
  const hasJsa = isJsaComplete(permit.jsaRecords[0]?.dataJson);

  let workplacePrepChecklistDone = false;
  if (permit.status === PermitStatus.APPROVED && input.toStatus === PermitStatus.ACTIVE) {
    const prepValidation = validateLifecycleChecklist(
      ptwTemplate.lifecycleChecklists.workplacePrep,
      input.payload?.checklist ?? {},
    );
    workplacePrepChecklistDone = prepValidation.valid;
  }

  let postWorkInspectionDone = false;
  if (permit.status === PermitStatus.ACTIVE && input.toStatus === PermitStatus.COMPLETED) {
    const postValidation = validateLifecycleChecklist(
      ptwTemplate.lifecycleChecklists.postWorkInspection,
      input.payload?.checklist ?? {},
    );
    postWorkInspectionDone = postValidation.valid;
  }

  const validation = validatePermitTransition({
    from: permit.status,
    to: input.toStatus,
    actor: effectiveRole,
    context: {
      now,
      validFrom: permit.validFrom,
      validTo: permit.validTo,
      comment: input.comment,
      allRequiredFieldsFilled: ptwFieldsValidation.valid && permit.validTo > permit.validFrom,
      hasJsa,
      additionalPermitsCreated,
      hasApplicantSignature,
      reviewCompletedWithMethodAndImpactNotes:
        typeof input.comment === 'string' && input.comment.trim().length > 0,
      revisionSaved: true,
      hasIssuerSignature,
      allAdditionalPermitsApproved,
      workplacePrepChecklistDone,
      postWorkInspectionDone,
      verifiedAndArchived: input.payload?.verifiedAndArchived === true,
    },
  });

  if (!validation.allowed) {
    const isRoleError = validation.reason?.includes('tidak berwenang');
    throw new ServiceError(
      isRoleError ? 403 : 422,
      validation.reason ?? 'Transisi status tidak diizinkan',
      !ptwFieldsValidation.valid ? { fieldErrors: ptwFieldsValidation.errors } : undefined,
    );
  }

  const isResubmit =
    permit.status === PermitStatus.RETURNED && input.toStatus === PermitStatus.SUBMITTED;
  const nextVersion = permit.currentVersion + 1;

  // Evaluate unfixed CRITICAL errors on the live permit snapshot at the moment of approval/issuance
  let transitionPayload: Record<string, unknown> | null = input.payload
    ? { ...input.payload }
    : null;

  if (
    (permit.status === PermitStatus.SUBMITTED &&
      input.toStatus === PermitStatus.PENDING_ISSUANCE) ||
    (permit.status === PermitStatus.PENDING_ISSUANCE &&
      input.toStatus === PermitStatus.APPROVED)
  ) {
    const seededErrors = parseSeededErrors(permit.session.scenario.seededErrorsJson);
    const initialData = parseScenarioInitialData(permit.session.scenario.initialDataJson);
    const unfixedCriticalErrorIds = evaluateUnfixedCriticalErrors(seededErrors, {
      ptwData: permitData,
      additionalPermits: permit.additionalPermits.map((ap) => ({
        type: ap.type,
        dataJson: (ap.dataJson as Record<string, unknown>) ?? {},
      })),
      jsaData: (permit.jsaRecords[0]?.dataJson as Record<string, unknown>) ?? undefined,
      initialPtwData: initialData.ptwData,
    });
    transitionPayload = {
      ...(transitionPayload ?? {}),
      unfixedCriticalErrorIds,
    };
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.permit.updateMany({
      where: {
        id: permit.id,
        tenantId: permit.tenantId,
        currentVersion: input.expectedVersion,
      },
      data: {
        status: input.toStatus,
        currentVersion: nextVersion,
      },
    });

    if (updated.count === 0) {
      throw new ServiceError(409, 'Konflik versi saat melakukan transisi status');
    }

    if (isResubmit) {
      await tx.permitVersion.create({
        data: {
          tenantId: permit.tenantId,
          permitId: permit.id,
          version: nextVersion,
          dataJson: permit.dataJson as Prisma.InputJsonValue,
          changedBy: user.id,
        },
      });
    }

    await tx.transition.create({
      data: {
        tenantId: permit.tenantId,
        permitId: permit.id,
        fromStatus: permit.status,
        toStatus: input.toStatus,
        actorId: user.id,
        actorRole: effectiveRole,
        comment: input.comment?.trim() || null,
        payloadJson: (transitionPayload ?? null) as Prisma.InputJsonValue,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: permit.tenantId,
        actorId: user.id,
        action: `TRANSITION_${permit.status}_TO_${input.toStatus}`,
        entity: 'Permit',
        entityId: permit.id,
        metadataJson: { fromStatus: permit.status, toStatus: input.toStatus },
      },
    });

    return tx.permit.findUniqueOrThrow({ where: { id: permit.id } });
  });
}

export async function addSupervisionNote(user: SessionUser, permitId: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ServiceError(422, 'Catatan pengawasan tidak boleh kosong');
  }

  const permit = await prisma.permit.findUnique({
    where: { id: permitId },
    include: { session: { include: { participants: true } } },
  });

  if (!permit) {
    throw new ServiceError(404, 'Izin tidak ditemukan');
  }

  assertTenantAccess(user, permit.tenantId);

  const effectiveRole = getEffectiveRole(user, permit.session);
  if (effectiveRole !== Role.COORDINATOR) {
    throw new ServiceError(403, 'Hanya COORDINATOR yang dapat menambahkan catatan pengawasan');
  }

  if (permit.status !== PermitStatus.ACTIVE) {
    throw new ServiceError(409, 'Catatan pengawasan hanya dapat ditambahkan selama izin ACTIVE');
  }

  return prisma.supervisionNote.create({
    data: {
      tenantId: permit.tenantId,
      permitId: permit.id,
      authorId: user.id,
      text: trimmed,
    },
  });
}
