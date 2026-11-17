import { describe, expect, it } from 'vitest';
import { syncDraftPayload } from '@/lib/offline-drafts';
import { buildPermitPdfHtml, generateQrCodeDataUrl } from '@/lib/pdf';
import { DEFAULT_PTW_TEMPLATE_SCHEMA } from '@/modules/permit/default-templates';

describe('M3 Offline Sync & QR Code PDF', () => {
  it('syncs offline draft cleanly on 200 and preserves conflict on 409', async () => {
    const draft = {
      permitId: 'perm-1',
      expectedVersion: 1,
      dataJson: { companyName: 'PT Offline' },
      updatedAt: new Date().toISOString(),
    };

    const okRes = await syncDraftPayload(
      draft,
      async () => new Response(JSON.stringify({ permit: {} }), { status: 200 }),
    );
    expect(okRes.status).toBe('synced');

    const conflictRes = await syncDraftPayload(
      draft,
      async () => new Response(JSON.stringify({ error: 'Konflik versi' }), { status: 409 }),
    );
    expect(conflictRes.status).toBe('conflict');

    const offlineRes = await syncDraftPayload(draft, async () => {
      throw new Error('Network down');
    });
    expect(offlineRes.status).toBe('offline');
  });

  it('generates QR code PNG data URL locally and embeds it in PDF HTML', async () => {
    const qrDataUrl = await generateQrCodeDataUrl('https://simulator-ptw.vercel.app/verify/perm-1');
    expect(qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);

    const html = buildPermitPdfHtml({
      permitId: 'perm-1',
      tenantName: 'PT Simulator PtW FJM',
      status: 'APPROVED',
      validFrom: new Date('2026-11-17T08:00:00Z'),
      validTo: new Date('2026-11-17T17:00:00Z'),
      timezone: 'Asia/Jakarta',
      heightThresholdMeters: 1.8,
      dataJson: {},
      ptwTemplate: DEFAULT_PTW_TEMPLATE_SCHEMA,
      additionalPermits: [],
      signatures: [],
      transitions: [],
      qrCodeDataUrl: qrDataUrl,
    });

    expect(html).toContain('alt="QR Verifikasi"');
    expect(html).toContain(qrDataUrl);
  });
});
