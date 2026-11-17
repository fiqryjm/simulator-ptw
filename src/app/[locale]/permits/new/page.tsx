import { Role, SessionStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';
import { createPermit } from '@/modules/permit/service';

export default async function NewPermitPage() {
  const user = await requireRole([Role.APPLICANT], { redirectOnFail: true });

  const activeSession = await prisma.session.findFirst({
    where: {
      tenantId: user.tenantId,
      status: SessionStatus.ACTIVE,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!activeSession) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Tidak ada sesi pelatihan aktif pada tenant Anda. Jalankan seed terlebih dahulu.
        </p>
      </main>
    );
  }

  const permit = await createPermit(user, { sessionId: activeSession.id, dataJson: {} });
  redirect(`/permits/${permit.id}`);
}
