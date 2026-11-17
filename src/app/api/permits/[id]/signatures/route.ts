import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { savePermitSignature } from '@/modules/permit/service';

const signatureSchema = z.object({
  role: z.nativeEnum(Role),
  imageData: z.string().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole([Role.APPLICANT, Role.ISSUER]);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = signatureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload tanda tangan tidak valid', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const signature = await savePermitSignature(user, id, parsed.data);
    return NextResponse.json({ signature }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
