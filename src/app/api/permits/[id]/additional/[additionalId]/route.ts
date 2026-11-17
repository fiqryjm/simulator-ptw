import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { updateAdditionalPermit } from '@/modules/permit/service';

const additionalBodySchema = z.object({
  dataJson: z.record(z.unknown()).optional(),
  decision: z.enum(['APPROVED', 'REJECTED']).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; additionalId: string }> },
) {
  try {
    const user = await requireRole([Role.APPLICANT, Role.ISSUER]);
    const { id, additionalId } = await context.params;
    const body = await request.json();
    const parsed = additionalBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload izin tambahan tidak valid', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const additionalPermit = await updateAdditionalPermit(user, id, additionalId, parsed.data);
    return NextResponse.json({ additionalPermit });
  } catch (error) {
    return handleApiError(error);
  }
}
