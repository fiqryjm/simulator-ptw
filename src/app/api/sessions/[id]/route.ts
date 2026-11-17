import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { getInstructorSessionSummary } from '@/modules/session/service';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole([Role.INSTRUCTOR, Role.TENANT_ADMIN, Role.SUPER_ADMIN]);
    const { id } = await context.params;
    const summary = await getInstructorSessionSummary(user, id);
    return NextResponse.json({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
