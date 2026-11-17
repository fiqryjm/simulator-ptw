import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { finalizeParticipantSession } from '@/modules/scoring/service';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole([
      Role.APPLICANT,
      Role.SUPERVISOR,
      Role.ISSUER,
      Role.COORDINATOR,
    ]);
    const { id } = await context.params;
    const result = await finalizeParticipantSession(user, id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
