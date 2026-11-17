import { randomInt } from 'crypto';
import {
  AdditionalPermitStatus,
  FormTemplateType,
  PermitStatus,
  Prisma,
  Role,
  SessionStatus,
} from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkLoginRateLimit, recordFailedLogin, resetLoginRateLimit } from '@/lib/rate-limit';
import { assertRole, assertTenantAccess, type SessionUser } from '@/lib/rbac';
import { ServiceError } from '@/modules/permit/errors';
import { DEFAULT_PTW_TEMPLATE_SCHEMA } from '@/modules/permit/default-templates';
import {
  extractTriggeredAdditionalPermits,
  type PtwTemplateSchema,
} from '@/modules/permit/template-schema';
import {
  parseScenarioInitialData,
  parseSeededErrors,
  resolveScenarioDates,
} from '@/modules/scenario/service';
import { recalculateSessionScores } from '@/modules/scoring/service';

const JOIN_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const JOIN_RATE_LIMIT_CONFIG = { windowMs: 10 * 60 * 1000, maxAttempts: 10 };

export function generateJoinCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += JOIN_CODE_ALPHABET[randomInt(0, JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

export const createSessionSchema = z.object({
  scenarioId: z.string().min(1),
  participants: z
    .array(
      z.object({
        userId: z.string().min(1),
        simulatedRole: z.nativeEnum(Role),
      }),
    )
    .optional()
    .default([]),
});

export async function listSessionsForUser(user: SessionUser) {
  if (
    user.role === Role.INSTRUCTOR ||
    user.role === Role.TENANT_ADMIN ||
    user.role === Role.SUPER_ADMIN
  ) {
    return prisma.session.findMany({
      where: { tenantId: user.tenantId },
      include: {
        scenario: { select: { id: true, title: true, industry: true } },
        _count: { select: { participants: true, permits: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  return prisma.session.findMany({
    where: {
      tenantId: user.tenantId,
      participants: { some: { userId: user.id } },
    },
    include: {
      scenario: { select: { id: true, title: true, industry: true } },
      participants: { where: { userId: user.id }, select: { simulatedRole: true, finalizedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createSession(user: SessionUser, rawInput: unknown) {
  assertRole(user, [Role.INSTRUCTOR, Role.TENANT_ADMIN]);

  const parsed = createSessionSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ServiceError(422, 'Data pembuatan sesi tidak valid', {
      issues: parsed.error.flatten(),
    });
  }

  const scenario = await prisma.scenario.findUnique({ where: { id: parsed.data.scenarioId } });
  if (!scenario) {
    throw new ServiceError(404, 'Skenario tidak ditemukan');
  }
  assertTenantAccess(user, scenario.tenantId);

  const initialData = parseScenarioInitialData(scenario.initialDataJson);
  const { validFrom, validTo } = resolveScenarioDates(initialData);

  const ptwTplRow = await prisma.formTemplate.findFirst({
    where: { tenantId: user.tenantId, type: FormTemplateType.PTW, industry: scenario.industry },
    orderBy: { version: 'desc' },
  });
  const ptwTemplate = ptwTplRow
    ? (ptwTplRow.schemaJson as unknown as PtwTemplateSchema)
    : DEFAULT_PTW_TEMPLATE_SCHEMA;
  const triggeredAdditional = extractTriggeredAdditionalPermits(ptwTemplate, initialData.ptwData);

  // Verify all participant users belong to the same tenant
  if (parsed.data.participants.length > 0) {
    const userIds = parsed.data.participants.map((p) => p.userId);
    const tenantUsers = await prisma.user.findMany({
      where: { id: { in: userIds }, tenantId: user.tenantId },
      select: { id: true },
    });
    if (tenantUsers.length !== new Set(userIds).size) {
      throw new ServiceError(403, 'Semua peserta harus berasal dari tenant yang sama');
    }
  }

  const applicantEntry = parsed.data.participants.find((p) => p.simulatedRole === Role.APPLICANT);
  const initialApplicantId = applicantEntry?.userId ?? user.id;

  let joinCode = generateJoinCode(6);
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.session.findUnique({ where: { joinCode } });
    if (!exists) break;
    joinCode = generateJoinCode(6);
  }

  const created = await prisma.$transaction(async (tx) => {
    const session = await tx.session.create({
      data: {
        tenantId: user.tenantId,
        scenarioId: scenario.id,
        instructorId: user.id,
        joinCode,
        status: SessionStatus.ACTIVE,
        startedAt: new Date(),
      },
    });

    for (const p of parsed.data.participants) {
      await tx.participant.create({
        data: {
          tenantId: user.tenantId,
          sessionId: session.id,
          userId: p.userId,
          simulatedRole: p.simulatedRole,
        },
      });
    }

    const permit = await tx.permit.create({
      data: {
        tenantId: user.tenantId,
        sessionId: session.id,
        applicantId: initialApplicantId,
        status: PermitStatus.DRAFT,
        dataJson: initialData.ptwData as Prisma.InputJsonValue,
        validFrom,
        validTo,
        currentVersion: 1,
      },
    });

    for (const addType of triggeredAdditional) {
      await tx.additionalPermit.create({
        data: {
          tenantId: user.tenantId,
          permitId: permit.id,
          type: addType,
          dataJson: {},
          status: AdditionalPermitStatus.DRAFT,
        },
      });
    }

    if (initialData.jsaData) {
      await tx.jsaRecord.create({
        data: {
          tenantId: user.tenantId,
          permitId: permit.id,
          dataJson: initialData.jsaData as Prisma.InputJsonValue,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'CREATE_SESSION',
        entity: 'Session',
        entityId: session.id,
      },
    });

    return { session, permit };
  });

  await recalculateSessionScores(created.session.id);
  return created;
}

export async function joinSessionByCode(user: SessionUser, joinCodeRaw: string) {
  const rateKey = `join:${user.id}`;
  const limit = checkLoginRateLimit(rateKey, Date.now(), JOIN_RATE_LIMIT_CONFIG);
  if (!limit.allowed) {
    throw new ServiceError(429, `Terlalu banyak percobaan kode gabung. Coba lagi dalam ${limit.retryAfterSeconds} detik.`);
  }

  const joinCode = joinCodeRaw.trim().toUpperCase();
  const session = await prisma.session.findUnique({
    where: { joinCode },
    include: { participants: true },
  });

  if (!session || session.tenantId !== user.tenantId) {
    recordFailedLogin(rateKey, Date.now(), JOIN_RATE_LIMIT_CONFIG);
    throw new ServiceError(404, 'Kode gabung sesi tidak ditemukan');
  }

  if (session.status === SessionStatus.COMPLETED) {
    throw new ServiceError(409, 'Sesi pelatihan sudah ditutup dan tidak menerima peserta baru');
  }

  resetLoginRateLimit(rateKey);

  const existing = session.participants.find((p) => p.userId === user.id);
  if (existing) {
    return { sessionId: session.id, participant: existing };
  }

  const assignedRole =
    user.role === Role.INSTRUCTOR ||
    user.role === Role.TENANT_ADMIN ||
    user.role === Role.SUPER_ADMIN
      ? Role.COORDINATOR
      : user.role;

  const participant = await prisma.participant.create({
    data: {
      tenantId: session.tenantId,
      sessionId: session.id,
      userId: user.id,
      simulatedRole: assignedRole,
    },
  });

  return { sessionId: session.id, participant };
}

export async function swapParticipantRole(
  user: SessionUser,
  sessionId: string,
  input: { participantId: string; simulatedRole: Role },
) {
  assertRole(user, [Role.INSTRUCTOR, Role.TENANT_ADMIN]);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { participants: true, permits: true },
  });
  if (!session) {
    throw new ServiceError(404, 'Sesi tidak ditemukan');
  }
  assertTenantAccess(user, session.tenantId);

  if (user.role === Role.INSTRUCTOR && session.instructorId !== user.id) {
    throw new ServiceError(403, 'Hanya instruktur sesi ini yang dapat menukar peran');
  }

  const target = session.participants.find((p) => p.id === input.participantId);
  if (!target) {
    throw new ServiceError(404, 'Peserta tidak ditemukan dalam sesi ini');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedParticipant = await tx.participant.update({
      where: { id: target.id },
      data: { simulatedRole: input.simulatedRole },
    });

    if (input.simulatedRole === Role.APPLICANT) {
      await tx.permit.updateMany({
        where: { sessionId: session.id, tenantId: session.tenantId },
        data: { applicantId: target.userId },
      });
    }

    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        actorId: user.id,
        action: 'SWAP_PARTICIPANT_ROLE',
        entity: 'Participant',
        entityId: target.id,
        metadataJson: {
          fromRole: target.simulatedRole,
          toRole: input.simulatedRole,
        },
      },
    });

    return updatedParticipant;
  });

  await recalculateSessionScores(session.id);
  return updated;
}

export async function resetSession(
  user: SessionUser,
  sessionId: string,
  expectedVersion?: number,
) {
  assertRole(user, [Role.INSTRUCTOR, Role.TENANT_ADMIN]);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      scenario: true,
      participants: true,
      permits: true,
    },
  });

  if (!session) {
    throw new ServiceError(404, 'Sesi tidak ditemukan');
  }
  assertTenantAccess(user, session.tenantId);

  if (user.role === Role.INSTRUCTOR && session.instructorId !== user.id) {
    throw new ServiceError(403, 'Hanya instruktur sesi ini yang dapat mereset sesi');
  }

  if (expectedVersion !== undefined && session.version !== expectedVersion) {
    throw new ServiceError(409, 'Konflik versi sesi saat reset. Muat ulang halaman.');
  }

  const initialData = parseScenarioInitialData(session.scenario.initialDataJson);
  const { validFrom, validTo } = resolveScenarioDates(initialData);
  const applicantParticipant = session.participants.find(
    (p) => p.simulatedRole === Role.APPLICANT,
  );
  const applicantId = applicantParticipant?.userId ?? session.instructorId;

  const ptwTplRow = await prisma.formTemplate.findFirst({
    where: {
      tenantId: session.tenantId,
      type: FormTemplateType.PTW,
      industry: session.scenario.industry,
    },
    orderBy: { version: 'desc' },
  });
  const ptwTemplate = ptwTplRow
    ? (ptwTplRow.schemaJson as unknown as PtwTemplateSchema)
    : DEFAULT_PTW_TEMPLATE_SCHEMA;
  const triggeredAdditional = extractTriggeredAdditionalPermits(ptwTemplate, initialData.ptwData);

  await prisma.$transaction(async (tx) => {
    const permitIds = session.permits.map((p) => p.id);

    if (permitIds.length > 0) {
      await tx.additionalPermit.deleteMany({ where: { permitId: { in: permitIds } } });
      await tx.jsaRecord.deleteMany({ where: { permitId: { in: permitIds } } });
      await tx.signature.deleteMany({ where: { permitId: { in: permitIds } } });
      await tx.transition.deleteMany({ where: { permitId: { in: permitIds } } });
      await tx.supervisionNote.deleteMany({ where: { permitId: { in: permitIds } } });
      await tx.errorFlag.deleteMany({ where: { permitId: { in: permitIds } } });
      await tx.permitVersion.deleteMany({ where: { permitId: { in: permitIds } } });
    }

    await tx.score.deleteMany({ where: { sessionId: session.id } });
    await tx.participant.updateMany({
      where: { sessionId: session.id },
      data: { finalizedAt: null },
    });

    for (const permit of session.permits) {
      await tx.permit.update({
        where: { id: permit.id },
        data: {
          status: PermitStatus.DRAFT,
          applicantId,
          dataJson: initialData.ptwData as Prisma.InputJsonValue,
          validFrom,
          validTo,
          currentVersion: permit.currentVersion + 1,
        },
      });

      for (const addType of triggeredAdditional) {
        await tx.additionalPermit.create({
          data: {
            tenantId: session.tenantId,
            permitId: permit.id,
            type: addType,
            dataJson: {},
            status: AdditionalPermitStatus.DRAFT,
          },
        });
      }

      if (initialData.jsaData) {
        await tx.jsaRecord.create({
          data: {
            tenantId: session.tenantId,
            permitId: permit.id,
            dataJson: initialData.jsaData as Prisma.InputJsonValue,
          },
        });
      }
    }

    await tx.session.update({
      where: { id: session.id },
      data: {
        status: SessionStatus.ACTIVE,
        version: session.version + 1,
        endedAt: null,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        actorId: user.id,
        action: 'RESET_SESSION',
        entity: 'Session',
        entityId: session.id,
      },
    });
  });

  await recalculateSessionScores(session.id);
  return { reset: true };
}

export async function closeSession(user: SessionUser, sessionId: string) {
  assertRole(user, [Role.INSTRUCTOR, Role.TENANT_ADMIN]);

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new ServiceError(404, 'Sesi tidak ditemukan');
  }
  assertTenantAccess(user, session.tenantId);

  if (user.role === Role.INSTRUCTOR && session.instructorId !== user.id) {
    throw new ServiceError(403, 'Hanya instruktur sesi ini yang dapat menutup sesi');
  }

  await recalculateSessionScores(session.id);

  return prisma.session.update({
    where: { id: session.id },
    data: {
      status: SessionStatus.COMPLETED,
      endedAt: new Date(),
      version: session.version + 1,
    },
  });
}

export async function getInstructorSessionSummary(user: SessionUser, sessionId: string) {
  assertRole(user, [Role.INSTRUCTOR, Role.TENANT_ADMIN, Role.SUPER_ADMIN]);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      scenario: true,
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          scores: { where: { sessionId } },
          errorFlags: { select: { id: true, seededErrorId: true, fieldPath: true, reason: true } },
        },
      },
      permits: {
        select: { id: true, status: true, currentVersion: true, updatedAt: true },
      },
    },
  });

  if (!session) {
    throw new ServiceError(404, 'Sesi tidak ditemukan');
  }
  assertTenantAccess(user, session.tenantId);

  if (user.role === Role.INSTRUCTOR && session.instructorId !== user.id) {
    throw new ServiceError(403, 'Hanya instruktur sesi ini yang dapat memantau sesi');
  }

  const seededErrors = parseSeededErrors(session.scenario.seededErrorsJson);
  const foundErrorIds = new Set<string>();
  for (const p of session.participants) {
    for (const f of p.errorFlags) {
      if (f.seededErrorId) {
        foundErrorIds.add(f.seededErrorId);
      }
    }
  }

  const missedErrors = seededErrors.filter((e) => !foundErrorIds.has(e.id));

  return {
    id: session.id,
    joinCode: session.joinCode,
    status: session.status,
    version: session.version,
    scenario: {
      id: session.scenario.id,
      title: session.scenario.title,
      industry: session.scenario.industry,
      seededErrors,
    },
    permits: session.permits,
    participants: session.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user.name,
      email: p.user.email,
      simulatedRole: p.simulatedRole,
      finalizedAt: p.finalizedAt,
      flagCount: p.errorFlags.length,
      totalScore: p.scores[0]?.totalScore ?? 0,
      breakdown: p.scores[0]?.breakdownJson ?? null,
    })),
    missedErrorsSummary: missedErrors.map((e) => ({
      id: e.id,
      fieldPath: e.fieldPath,
      severity: e.severity,
      description: e.description,
    })),
    updatedAt: new Date().toISOString(),
  };
}
