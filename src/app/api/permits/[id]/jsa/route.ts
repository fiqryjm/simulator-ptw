import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { upsertJsaForPermit } from '@/modules/jsa/service';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole([Role.APPLICANT]);
    const { id } = await context.params;
    const body = await request.json();
    const jsa = await upsertJsaForPermit(user, id, body);
    return NextResponse.json({ jsa });
  } catch (error) {
    return handleApiError(error);
  }
}
