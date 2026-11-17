import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { exportSessionScoresCsv } from '@/modules/scoring/service';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole([Role.INSTRUCTOR, Role.TENANT_ADMIN, Role.SUPER_ADMIN]);
    const { id } = await context.params;
    const csv = await exportSessionScoresCsv(user, id);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="session-${id}-report.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
