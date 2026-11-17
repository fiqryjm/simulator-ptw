import { Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertTenantAccess, getEffectiveRole, type SessionUser } from '@/lib/rbac';
import { ServiceError } from '@/modules/permit/errors';

export const jsaStepSchema = z.object({
  activity: z.string().trim().min(1, 'Aktivitas langkah kerja wajib diisi'),
  hazardCode: z.string().trim().min(1, 'Kode bahaya wajib dipilih'),
  hazardDescription: z.string().trim().min(1, 'Deskripsi bahaya potensial wajib diisi'),
  controlMeasure: z.string().trim().min(1, 'Prosedur kerja aman wajib diisi'),
});

export const jsaCrewMemberSchema = z.object({
  name: z.string().trim().min(1, 'Nama kru wajib diisi'),
  signedIn: z.boolean(),
  signedOut: z.boolean().optional().default(false),
});

export const jsaDataSchema = z.object({
  supervisorName: z.string().trim().min(1, 'Nama pengawas wajib diisi'),
  contractorName: z.string().trim().min(1, 'Nama kontraktor wajib diisi'),
  date: z.string().trim().min(1, 'Tanggal JSA wajib diisi'),
  workLocation: z.string().trim().min(1, 'Lokasi kerja wajib diisi'),
  steps: z.array(jsaStepSchema).min(1, 'Minimal 1 langkah kerja JSA wajib diisi'),
  checklists: z.object({
    firePrevention: z.enum(['YES', 'NO']),
    ppe: z.enum(['YES', 'NO']),
    poweredEquipment: z.enum(['YES', 'NO']),
    workPlatform: z.enum(['YES', 'NO']),
    barricades: z.enum(['YES', 'NO']),
  }),
  crew: z.array(jsaCrewMemberSchema).min(1, 'Minimal 1 kru menandatangani sign-in'),
});

export type JsaDataInput = z.infer<typeof jsaDataSchema>;

export function isJsaComplete(data: unknown): boolean {
  const parsed = jsaDataSchema.safeParse(data);
  if (!parsed.success) return false;
  return parsed.data.crew.some((member) => member.signedIn);
}

export async function upsertJsaForPermit(
  user: SessionUser,
  permitId: string,
  rawInput: unknown,
) {
  const permit = await prisma.permit.findUnique({
    where: { id: permitId },
    include: {
      jsaRecords: true,
      session: { include: { participants: true } },
    },
  });

  if (!permit) {
    throw new ServiceError(404, 'Izin tidak ditemukan');
  }

  assertTenantAccess(user, permit.tenantId);

  const effectiveRole = getEffectiveRole(user, permit.session);
  if (effectiveRole !== Role.APPLICANT) {
    throw new ServiceError(403, 'Hanya APPLICANT yang dapat mengisi atau mengubah JSA');
  }

  if (permit.status !== 'DRAFT' && permit.status !== 'RETURNED') {
    throw new ServiceError(409, 'JSA bersifat read-only setelah izin diajukan');
  }

  const parsed = jsaDataSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ServiceError(422, 'Data JSA tidak lengkap atau tidak valid', {
      issues: parsed.error.flatten(),
    });
  }

  const existing = permit.jsaRecords[0];
  const jsonPayload = parsed.data as unknown as Prisma.InputJsonValue;

  if (existing) {
    return prisma.jsaRecord.update({
      where: { id: existing.id },
      data: { dataJson: jsonPayload },
    });
  }

  return prisma.jsaRecord.create({
    data: {
      tenantId: permit.tenantId,
      permitId: permit.id,
      dataJson: jsonPayload,
    },
  });
}
