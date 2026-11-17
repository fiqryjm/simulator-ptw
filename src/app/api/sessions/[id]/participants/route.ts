import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { swapParticipantRole } from '@/modules/session/service';

const swapSchema = z.object({
  participantId: z.string().min(1),
  simulatedRole: z.nativeEnum(Role),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole([Role.INSTRUCTOR, Role.TENANT_ADMIN]);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = swapSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload penukaran peran tidak valid' }, { status: 422 });
    }
    const participant = await swapParticipantRole(user, id, parsed.data);
    return NextResponse.json({ participant });
  } catch (error) {
    return handleApiError(error);
  }
}
