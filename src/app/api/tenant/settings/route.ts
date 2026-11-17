import { Prisma, Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { parseTenantSettings, scoringWeightsSchema } from '@/lib/datetime';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';

const updateTenantSettingsSchema = z.object({
  heightThresholdMeters: z.number().min(0.5).max(10),
  timezone: z.string().min(1),
  defaultLocale: z.enum(['id', 'en']),
  scoringWeights: scoringWeightsSchema,
});

export async function GET() {
  try {
    const user = await requireRole([Role.TENANT_ADMIN, Role.INSTRUCTOR]);
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { id: true, name: true, settings: true },
    });
    return NextResponse.json({
      tenant: { id: tenant.id, name: tenant.name, settings: parseTenantSettings(tenant.settings) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireRole([Role.TENANT_ADMIN]);
    const body = await request.json();
    const parsed = updateTenantSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Pengaturan tenant tidak valid', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({
        where: { id: user.tenantId },
        data: { settings: parsed.data as unknown as Prisma.InputJsonValue },
      });

      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          actorId: user.id,
          action: 'UPDATE_TENANT_SETTINGS',
          entity: 'Tenant',
          entityId: user.tenantId,
          metadataJson: parsed.data as unknown as Prisma.InputJsonValue,
        },
      });

      return tenant;
    });

    return NextResponse.json({ settings: parseTenantSettings(updated.settings) });
  } catch (error) {
    return handleApiError(error);
  }
}
