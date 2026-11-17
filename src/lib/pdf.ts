import { chromium } from 'playwright';
import { formatInTenantTimezone } from '@/lib/datetime';
import {
  getLocalizedText,
  interpolateLocalizedText,
  type PtwTemplateSchema,
} from '@/modules/permit/template-schema';

export const PDF_WATERMARK_TEXT = 'SIMULASI — BUKAN IZIN KERJA RESMI';

export function escapeHtml(input: unknown): string {
  const str = input === null || input === undefined ? '' : String(input);
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safePngDataUrl(url: string | undefined): string | null {
  if (!url) return null;
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(url) ? url : null;
}

export interface PermitPdfInput {
  permitId: string;
  tenantName: string;
  status: string;
  validFrom: Date;
  validTo: Date;
  timezone: string;
  heightThresholdMeters: number;
  dataJson: Record<string, unknown>;
  ptwTemplate: PtwTemplateSchema;
  additionalPermits: Array<{
    type: string;
    status: string;
    dataJson: Record<string, unknown>;
  }>;
  jsaData?: Record<string, unknown>;
  signatures: Array<{
    role: string;
    userName: string;
    signedAt: Date;
    imageData: string;
  }>;
  transitions: Array<{
    fromStatus: string;
    toStatus: string;
    actorRole: string;
    comment: string | null;
    at: Date;
  }>;
}

export function buildPermitPdfHtml(input: PermitPdfInput): string {
  const sectionsHtml = input.ptwTemplate.sections
    .map((section) => {
      const rows = section.fields
        .map((field) => {
          const label = getLocalizedText(
            interpolateLocalizedText(field.label, {
              heightThresholdMeters: input.heightThresholdMeters,
            }),
            'id',
          );
          const rawVal = input.dataJson[field.key];
          const displayVal =
            field.type === 'datetime' && rawVal
              ? formatInTenantTimezone(String(rawVal), input.timezone, 'id')
              : rawVal === 'YES'
                ? 'Ya'
                : rawVal === 'NO'
                  ? 'Tidak'
                  : String(rawVal ?? '-');
          const notes = input.dataJson[`${field.key}_notes`];
          const noteSuffix = notes ? ` (${escapeHtml(notes)})` : '';

          return `<tr>
            <td class="label-col">${escapeHtml(label)}</td>
            <td class="val-col">${escapeHtml(displayVal)}${noteSuffix}</td>
          </tr>`;
        })
        .join('');

      return `
        <h2>${escapeHtml(section.title.id)}</h2>
        <table><tbody>${rows}</tbody></table>
      `;
    })
    .join('');

  const additionalHtml =
    input.additionalPermits.length === 0
      ? '<p>Tidak ada izin tambahan.</p>'
      : input.additionalPermits
          .map(
            (ap) => `
          <div class="box">
            <strong>${escapeHtml(ap.type)}</strong> — Status: <span>${escapeHtml(ap.status)}</span>
            <pre>${escapeHtml(JSON.stringify(ap.dataJson, null, 2))}</pre>
          </div>
        `,
          )
          .join('');

  const jsaSteps = Array.isArray(input.jsaData?.steps)
    ? (input.jsaData?.steps as Array<Record<string, unknown>>)
    : [];
  const jsaHtml =
    jsaSteps.length === 0
      ? '<p>Belum ada data JSA.</p>'
      : `<table>
          <thead><tr><th>No</th><th>Aktivitas</th><th>Kode</th><th>Bahaya Potensial</th><th>Pengendalian</th></tr></thead>
          <tbody>
            ${jsaSteps
              .map(
                (s, idx) => `<tr>
                  <td>${idx + 1}</td>
                  <td>${escapeHtml(s.activity)}</td>
                  <td>${escapeHtml(s.hazardCode)}</td>
                  <td>${escapeHtml(s.hazardDescription)}</td>
                  <td>${escapeHtml(s.controlMeasure)}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>`;

  const sigHtml = input.signatures
    .map((sig) => {
      const safeImg = safePngDataUrl(sig.imageData);
      return `<div class="sig-card">
        <div><strong>${escapeHtml(sig.role)}</strong></div>
        <div>${escapeHtml(sig.userName)}</div>
        <div>${escapeHtml(formatInTenantTimezone(sig.signedAt, input.timezone, 'id'))}</div>
        ${safeImg ? `<img src="${safeImg}" alt="Tanda tangan ${escapeHtml(sig.role)}" />` : ''}
      </div>`;
    })
    .join('');

  const transitionsHtml = input.transitions
    .map(
      (t) => `<tr>
        <td>${escapeHtml(formatInTenantTimezone(t.at, input.timezone, 'id'))}</td>
        <td>${escapeHtml(t.fromStatus)} &rarr; ${escapeHtml(t.toStatus)}</td>
        <td>${escapeHtml(t.actorRole)}</td>
        <td>${escapeHtml(t.comment ?? '-')}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>PTW ${escapeHtml(input.permitId)}</title>
  <style>
    @page { size: A4; margin: 18mm 14mm; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; position: relative; }
    .watermark {
      position: fixed;
      top: 42%;
      left: 5%;
      width: 90%;
      text-align: center;
      font-size: 26px;
      font-weight: 800;
      color: rgba(234, 88, 12, 0.22);
      transform: rotate(-30deg);
      pointer-events: none;
      z-index: 9999;
      letter-spacing: 2px;
    }
    .header { border-bottom: 2px solid #0f2942; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; }
    h1 { font-size: 16px; margin: 0; color: #0f2942; }
    h2 { font-size: 13px; margin: 14px 0 6px; color: #0f2942; border-left: 4px solid #ea580c; padding-left: 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
    .label-col { width: 48%; font-weight: 600; background: #f8fafc; }
    .box { border: 1px solid #cbd5e1; padding: 6px; margin-bottom: 6px; }
    pre { margin: 4px 0 0; font-size: 10px; white-space: pre-wrap; }
    .sig-grid { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 8px; }
    .sig-card { border: 1px solid #cbd5e1; padding: 8px; width: 220px; }
    .sig-card img { max-width: 190px; max-height: 70px; margin-top: 6px; display: block; }
  </style>
</head>
<body>
  <div class="watermark">${escapeHtml(PDF_WATERMARK_TEXT)}</div>
  <div class="header">
    <div>
      <h1>IJIN KERJA KONTRAKTOR (FR-HSSE-0317) — ${escapeHtml(input.tenantName)}</h1>
      <div>ID Izin: ${escapeHtml(input.permitId)} · Status: <strong>${escapeHtml(input.status)}</strong></div>
    </div>
    <div>
      <div>Berlaku: ${escapeHtml(formatInTenantTimezone(input.validFrom, input.timezone, 'id'))}</div>
      <div>Sampai: ${escapeHtml(formatInTenantTimezone(input.validTo, input.timezone, 'id'))}</div>
    </div>
  </div>

  ${sectionsHtml}

  <h2>Izin Tambahan</h2>
  ${additionalHtml}

  <h2>Job Safety Analysis (JSA)</h2>
  ${jsaHtml}

  <h2>Pernyataan dan Tanda Tangan</h2>
  <div class="sig-grid">${sigHtml || '<p>Belum ada tanda tangan.</p>'}</div>

  <h2>Riwayat Transisi</h2>
  <table>
    <thead><tr><th>Waktu</th><th>Transisi</th><th>Peran</th><th>Catatan</th></tr></thead>
    <tbody>${transitionsHtml}</tbody>
  </table>
</body>
</html>`;
}

/**
 * Converts self-contained HTML into a PDF Buffer using Playwright Chromium.
 * Blocks all external network requests to prevent SSRF.
 */
export async function generatePermitPdfBuffer(html: string): Promise<Buffer> {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  let browser;
  if (isServerless) {
    const sparticuz = (await import('@sparticuz/chromium')).default;
    const executablePath = await sparticuz.executablePath();
    browser = await chromium.launch({
      args: sparticuz.args,
      executablePath,
      headless: true,
    });
  } else {
    browser = await chromium.launch({ headless: true });
  }
  try {
    const page = await browser.newPage();
    await page.route('**/*', (route) => route.abort());
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
    });
    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}
