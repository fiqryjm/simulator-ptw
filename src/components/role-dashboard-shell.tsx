import { Role } from '@prisma/client';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { signOut } from '@/lib/auth';
import { getEffectiveRole, type SessionUser } from '@/lib/rbac';
import { getWaitingPermitsForUser, listPermitsForTenant } from '@/modules/permit/service';
import { PermitStatusBadge } from '@/components/permit-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RoleDashboardShellProps {
  user: SessionUser;
  expectedRole: Role;
}

export async function RoleDashboardShell({ user, expectedRole }: RoleDashboardShellProps) {
  const tApp = await getTranslations('app');
  const tRoles = await getTranslations('roles');
  const tDash = await getTranslations('dashboard');
  const roleLabel = tRoles(expectedRole);
  const effectiveRole = getEffectiveRole(user);

  const [waitingPermits, allPermits] = await Promise.all([
    getWaitingPermitsForUser(user),
    listPermitsForTenant(user),
  ]);

  async function handleSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0f2942]">
            {tDash('welcome', { name: user.name })}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600">{tDash('roleLabel')}:</span>
            <Badge data-testid="role-badge" className="border-[#0f2942] bg-[#0f2942] text-white">
              {roleLabel} ({effectiveRole})
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {effectiveRole === Role.APPLICANT ? (
            <Link href="/permits/new">
              <Button variant="accent" data-testid="create-permit-btn">
                {tDash('createPermit')}
              </Button>
            </Link>
          ) : null}
          <form action={handleSignOut}>
            <Button type="submit" variant="outline">
              {tApp('logout')}
            </Button>
          </form>
        </div>
      </header>

      <main className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle data-testid="waiting-actions-title">
              {tDash('waitingTitle', { count: waitingPermits.length })}
            </CardTitle>
            <CardDescription>
              {waitingPermits.length === 0 ? tDash('waitingEmpty') : tDash('allPermitsTitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {waitingPermits.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#0f2942]">#{p.id.slice(-8)}</span>
                    <PermitStatusBadge status={p.status} />
                  </div>
                  <div className="text-xs text-slate-600">
                    {p.session.scenario.title} · Pemohon: {p.applicant.name}
                  </div>
                </div>
                <Link href={`/permits/${p.id}`}>
                  <Button size="sm" variant="outline">
                    {tDash('openPermit')}
                  </Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tDash('allPermitsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {allPermits.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada izin kerja pada tenant ini.</p>
            ) : (
              allPermits.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#0f2942]">#{p.id.slice(-8)}</span>
                      <PermitStatusBadge status={p.status} />
                    </div>
                    <div className="text-xs text-slate-600">
                      {p.session.scenario.title} · Pemohon: {p.applicant.name}
                    </div>
                  </div>
                  <Link href={`/permits/${p.id}`}>
                    <Button size="sm" variant="outline">
                      {tDash('openPermit')}
                    </Button>
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
