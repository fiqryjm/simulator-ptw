import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { flagPermitError, getPermitFlagsAndFeedback } from '@/modules/scoring/service';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole([
      Role.APPLICANT,
      Role.SUPERVISOR,
      Role.ISSUER,
      Role.COORDINATOR,
      Role.INSTRUCTOR,
      Role.TENANT_ADMIN,
      Role.SUPER_ADMIN,
    ]);
    const { id } = await context.params;
    const data = await getPermitFlagsAndFeedback(user, id);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
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
    const body = await request.json();
    const flag = await flagPermitError(user, id, body);
    return NextResponse.json({ flag }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
