import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { resetSession } from '@/modules/session/service';

const resetSchema = z.object({
  expectedVersion: z.number().int().positive().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole([Role.INSTRUCTOR, Role.TENANT_ADMIN]);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = resetSchema.safeParse(body);
    const result = await resetSession(
      user,
      id,
      parsed.success ? parsed.data.expectedVersion : undefined,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
