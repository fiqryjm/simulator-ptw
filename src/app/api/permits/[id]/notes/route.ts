import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { addSupervisionNote } from '@/modules/permit/service';

const noteSchema = z.object({
  text: z.string().trim().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole([Role.COORDINATOR]);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = noteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Catatan pengawasan tidak boleh kosong', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const note = await addSupervisionNote(user, id, parsed.data.text);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
