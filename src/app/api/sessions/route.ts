import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { createSession, listSessionsForUser } from '@/modules/session/service';

export async function GET() {
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
    const sessions = await listSessionsForUser(user);
    return NextResponse.json({ sessions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole([Role.INSTRUCTOR, Role.TENANT_ADMIN]);
    const body = await request.json();
    const created = await createSession(user, body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
