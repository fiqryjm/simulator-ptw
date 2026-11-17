import { Role } from '@prisma/client';
import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PermitDetailWorkspace, type PermitDetailPayload } from '@/components/permit-detail-workspace';
import { getEffectiveRole } from '@/lib/rbac';
import { requireRole } from '@/lib/server-auth';
import { getPermitDetail } from '@/modules/permit/service';

export default async function PermitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(
    [
      Role.APPLICANT,
      Role.SUPERVISOR,
      Role.ISSUER,
      Role.COORDINATOR,
      Role.INSTRUCTOR,
      Role.TENANT_ADMIN,
    ],
    { redirectOnFail: true },
  );

  const { id } = await params;
  const locale = await getLocale();

  try {
    const detail = await getPermitDetail(user, id);
    const effectiveRole = getEffectiveRole(user, detail.permit.session);

    const serialized = JSON.parse(JSON.stringify(detail)) as PermitDetailPayload;

    return (
      <PermitDetailWorkspace
        initialDetail={serialized}
        effectiveRole={effectiveRole}
        locale={locale}
      />
    );
  } catch {
    notFound();
  }
}
