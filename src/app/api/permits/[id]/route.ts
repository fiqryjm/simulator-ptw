import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { getPermitDetail, updatePermitDraft } from '@/modules/permit/service';

const patchPermitSchema = z.object({
  expectedVersion: z.number().int().positive(),
  dataJson: z.record(z.unknown()),
});

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
    ]);
    const { id } = await context.params;
    const detail = await getPermitDetail(user, id);
    return NextResponse.json(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole([Role.APPLICANT]);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = patchPermitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload pembaruan draf tidak valid', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const permit = await updatePermitDraft(user, id, parsed.data);
    return NextResponse.json({ permit });
  } catch (error) {
    return handleApiError(error);
  }
}
