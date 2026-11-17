import { Role } from '@prisma/client';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
import { handleApiError } from '@/lib/api-response';
import { DEFAULT_TIMEZONE } from '@/lib/datetime';
import { buildPermitPdfHtml, generatePermitPdfBuffer } from '@/lib/pdf';
import { requireRole } from '@/lib/server-auth';
import { getPermitDetail } from '@/modules/permit/service';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole([
      Role.APPLICANT,
      Role.SUPERVISOR,
      Role.ISSUER,
      Role.COORDINATOR,
      Role.INSTRUCTOR,
      Role.TENANT_ADMIN,
    ]);
    const { id } = await context.params;
    const { permit, ptwTemplate, tenantSettings } = await getPermitDetail(user, id);

    const html = buildPermitPdfHtml({
      permitId: permit.id,
      tenantName: permit.tenant.name,
      status: permit.status,
      validFrom: permit.validFrom,
      validTo: permit.validTo,
      timezone: tenantSettings.timezone ?? DEFAULT_TIMEZONE,
      heightThresholdMeters: tenantSettings.heightThresholdMeters ?? 1.8,
      dataJson: (permit.dataJson as Record<string, unknown>) ?? {},
      ptwTemplate,
      additionalPermits: permit.additionalPermits.map((ap) => ({
        type: ap.type,
        status: ap.status,
        dataJson: (ap.dataJson as Record<string, unknown>) ?? {},
      })),
      jsaData: (permit.jsaRecords[0]?.dataJson as Record<string, unknown>) ?? undefined,
      signatures: permit.signatures.map((sig) => ({
        role: sig.role,
        userName: sig.user.name,
        signedAt: sig.signedAt,
        imageData: sig.imageData,
      })),
      transitions: permit.transitions.map((t) => ({
        fromStatus: t.fromStatus,
        toStatus: t.toStatus,
        actorRole: t.actorRole,
        comment: t.comment,
        at: t.at,
      })),
    });

    const pdfBuffer = await generatePermitPdfBuffer(html);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="ptw-${permit.id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
