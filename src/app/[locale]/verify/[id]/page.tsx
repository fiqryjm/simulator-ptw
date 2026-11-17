import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { PermitStatusBadge } from '@/components/permit-status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_TIMEZONE, formatInTenantTimezone, parseTenantSettings } from '@/lib/datetime';
import { PDF_WATERMARK_TEXT } from '@/lib/pdf';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Public QR verification page (FR-61).
 * Exposes ONLY minimal verification metadata (ID, status, tenant name, validity window)
 * and the simulation disclaimer — never form contents, participant PII, or seeded errors.
 */
export default async function VerifyPermitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();

  const permit = await prisma.permit.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      validFrom: true,
      validTo: true,
      tenant: { select: { name: true, settings: true } },
    },
  });

  if (!permit) {
    notFound();
  }

  const settings = parseTenantSettings(permit.tenant.settings);
  const timezone = settings.timezone ?? DEFAULT_TIMEZONE;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <div className="mb-2 rounded border border-orange-300 bg-orange-50 px-3 py-1.5 text-center text-xs font-bold text-orange-900">
            {PDF_WATERMARK_TEXT}
          </div>
          <CardTitle className="text-lg text-[#0f2942]">
            {locale === 'en' ? 'Permit Status Verification' : 'Verifikasi Status Izin Kerja'}
          </CardTitle>
          <CardDescription>{permit.tenant.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-600">ID Izin</span>
            <code className="font-semibold">{permit.id}</code>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-600">Status</span>
            <PermitStatusBadge status={permit.status} />
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-600">{locale === 'en' ? 'Valid From' : 'Berlaku Mulai'}</span>
            <span>{formatInTenantTimezone(permit.validFrom, timezone, locale)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">{locale === 'en' ? 'Valid Until' : 'Berlaku Sampai'}</span>
            <span>{formatInTenantTimezone(permit.validTo, timezone, locale)}</span>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
