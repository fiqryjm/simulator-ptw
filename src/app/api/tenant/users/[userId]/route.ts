import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { assertTenantAccess } from '@/lib/rbac';
import { requireRole } from '@/lib/server-auth';

const updateUserSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const actor = await requireRole([Role.TENANT_ADMIN]);
    const { userId } = await context.params;
    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload tidak valid' }, { status: 422 });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    assertTenantAccess(actor, target.tenantId);

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { isActive: parsed.data.isActive },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorId: actor.id,
        action: parsed.data.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        entity: 'User',
        entityId: target.id,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
