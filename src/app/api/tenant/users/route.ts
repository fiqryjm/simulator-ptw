import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { hashPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(2),
  password: z.string().min(8),
  role: z.enum([
    Role.APPLICANT,
    Role.SUPERVISOR,
    Role.ISSUER,
    Role.COORDINATOR,
    Role.INSTRUCTOR,
    Role.TENANT_ADMIN,
  ]),
});

export async function GET() {
  try {
    const user = await requireRole([Role.TENANT_ADMIN]);
    const users = await prisma.user.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole([Role.TENANT_ADMIN]);
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Data pengguna tidak valid', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const created = await prisma.user.create({
      data: {
        tenantId: actor.tenantId,
        email,
        name: parsed.data.name,
        passwordHash,
        role: parsed.data.role,
        isActive: true,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorId: actor.id,
        action: 'CREATE_TENANT_USER',
        entity: 'User',
        entityId: created.id,
      },
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
