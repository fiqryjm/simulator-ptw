import { Role } from '@prisma/client';
import { InstructorSessionConsole } from '@/components/instructor-session-console';
import { RoleDashboardShell } from '@/components/role-dashboard-shell';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';
import { listScenariosForManager } from '@/modules/scenario/service';
import { listSessionsForUser } from '@/modules/session/service';

export default async function InstructorDashboardPage() {
  const user = await requireRole([Role.INSTRUCTOR], { redirectOnFail: true });

  const [scenarios, sessions, tenantUsers] = await Promise.all([
    listScenariosForManager(user),
    listSessionsForUser(user),
    prisma.user.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div>
      <RoleDashboardShell user={user} expectedRole={Role.INSTRUCTOR} />
      <div className="mx-auto max-w-5xl px-4 pb-12">
        <InstructorSessionConsole
          scenarios={scenarios.map((s) => ({
            id: s.id,
            title: s.title,
            industry: s.industry,
          }))}
          tenantUsers={tenantUsers}
          initialSessions={sessions.map((s) => ({
            id: s.id,
            joinCode: s.joinCode,
            status: s.status,
            scenario: {
              title: s.scenario.title,
              industry: s.scenario.industry,
            },
          }))}
        />
      </div>
    </div>
  );
}
