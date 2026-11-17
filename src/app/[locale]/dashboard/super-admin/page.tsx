import { Role } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { RoleDashboardShell } from '@/components/role-dashboard-shell';

export default async function SuperAdminDashboardPage() {
  const user = await requireRole([Role.SUPER_ADMIN], { redirectOnFail: true });
  return <RoleDashboardShell user={user} expectedRole={Role.SUPER_ADMIN} />;
}
