import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { closeSession } from '@/modules/session/service';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole([Role.INSTRUCTOR, Role.TENANT_ADMIN]);
    const { id } = await context.params;
    const session = await closeSession(user, id);
    return NextResponse.json({ session });
  } catch (error) {
    return handleApiError(error);
  }
}
