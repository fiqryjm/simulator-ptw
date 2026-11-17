import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { listScenariosForManager } from '@/modules/scenario/service';

export async function GET() {
  try {
    const user = await requireRole([Role.INSTRUCTOR, Role.TENANT_ADMIN, Role.SUPER_ADMIN]);
    const scenarios = await listScenariosForManager(user);
    return NextResponse.json({ scenarios });
  } catch (error) {
    return handleApiError(error);
  }
}
