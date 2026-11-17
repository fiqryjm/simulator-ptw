import { Role } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { RoleDashboardShell } from '@/components/role-dashboard-shell';

export default async function SupervisorDashboardPage() {
  const user = await requireRole([Role.SUPERVISOR], { redirectOnFail: true });
  return <RoleDashboardShell user={user} expectedRole={Role.SUPERVISOR} />;
}
