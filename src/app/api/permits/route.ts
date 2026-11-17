import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { createPermit, listPermitsForTenant } from '@/modules/permit/service';

const createPermitBodySchema = z.object({
  sessionId: z.string().min(1),
  dataJson: z.record(z.unknown()).optional(),
});

export async function GET() {
  try {
    const user = await requireRole([
      Role.APPLICANT,
      Role.SUPERVISOR,
      Role.ISSUER,
      Role.COORDINATOR,
      Role.INSTRUCTOR,
      Role.TENANT_ADMIN,
    ]);
    const permits = await listPermitsForTenant(user);
    return NextResponse.json({ permits });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole([Role.APPLICANT]);
    const body = await request.json();
    const parsed = createPermitBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Input pembuatan izin tidak valid', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const permit = await createPermit(user, parsed.data);
    return NextResponse.json({ permit }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
