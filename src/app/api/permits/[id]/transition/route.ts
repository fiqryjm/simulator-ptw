import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { transitionPermit } from '@/modules/permit/service';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole([Role.APPLICANT, Role.SUPERVISOR, Role.ISSUER]);
    const { id } = await context.params;
    const body = await request.json();
    const permit = await transitionPermit(user, id, body);
    return NextResponse.json({ permit });
  } catch (error) {
    return handleApiError(error);
  }
}
