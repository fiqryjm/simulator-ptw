import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { joinSessionByCode } from '@/modules/session/service';

const joinSchema = z.object({
  joinCode: z.string().trim().min(4).max(16),
});

export async function POST(request: Request) {
  try {
    const user = await requireRole([
      Role.APPLICANT,
      Role.SUPERVISOR,
      Role.ISSUER,
      Role.COORDINATOR,
      Role.INSTRUCTOR,
      Role.TENANT_ADMIN,
    ]);
    const body = await request.json();
    const parsed = joinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Kode gabung tidak valid' }, { status: 422 });
    }
    const result = await joinSessionByCode(user, parsed.data.joinCode);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
