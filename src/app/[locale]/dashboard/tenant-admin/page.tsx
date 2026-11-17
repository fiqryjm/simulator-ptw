import { Role } from '@prisma/client';
import { RoleDashboardShell } from '@/components/role-dashboard-shell';
import { TenantAdminConsole } from '@/components/tenant-admin-console';
import { parseTenantSettings } from '@/lib/datetime';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';

export default async function TenantAdminDashboardPage() {
  const user = await requireRole([Role.TENANT_ADMIN], { redirectOnFail: true });

  const [tenant, users] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { settings: true },
    }),
    prisma.user.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, email: true, name: true, role: true, isActive: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return (
    <div>
      <RoleDashboardShell user={user} expectedRole={Role.TENANT_ADMIN} />
      <div className="mx-auto max-w-5xl px-4 pb-12">
        <TenantAdminConsole
          initialSettings={parseTenantSettings(tenant.settings)}
          initialUsers={users}
        />
      </div>
    </div>
  );
}
