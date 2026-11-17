import { describe, expect, it } from 'vitest';
import { buildPermitPdfHtml, escapeHtml, PDF_WATERMARK_TEXT } from '@/lib/pdf';
import { DEFAULT_PTW_TEMPLATE_SCHEMA } from '@/modules/permit/default-templates';
import {
  extractTriggeredAdditionalPermits,
  flattenPtwFields,
  interpolateLocalizedText,
  validateDynamicFields,
  validateLifecycleChecklist,
} from '@/modules/permit/template-schema';

describe('Template Schema & PDF Security', () => {
  it('interpolates configurable heightThresholdMeters per tenant', () => {
    const interpolated = interpolateLocalizedText(
      { id: 'Kerja di Ketinggian (> {{heightThresholdMeters}} m)', en: 'Height (> {{heightThresholdMeters}} m)' },
      { heightThresholdMeters: 2.0 },
    );
    expect(interpolated.id).toContain('2 m');
    expect(interpolated.en).toContain('2 m');
  });

  it('extracts triggered additional permits exclusively from template schema', () => {
    const triggered = extractTriggeredAdditionalPermits(DEFAULT_PTW_TEMPLATE_SCHEMA, {
      add_hot_work: 'YES',
      add_loto: 'NO',
      add_height: 'YES',
    });
    expect(triggered).toEqual(expect.arrayContaining(['HOT_WORK', 'HEIGHT']));
    expect(triggered).not.toContain('LOTO');
  });

  it('validates required dynamic fields and requireNotesOnYes', () => {
    const fields = flattenPtwFields(DEFAULT_PTW_TEMPLATE_SCHEMA);
    const missing = validateDynamicFields(fields, { add_hot_work: 'YES' }, { enforceRequired: true });
    expect(missing.valid).toBe(false);
    expect(missing.errors.companyName).toBeDefined();
    expect(missing.errors.add_hot_work_notes).toBeDefined();
  });

  it('validates FR-35 lifecycle checklists', () => {
    const prepFields = DEFAULT_PTW_TEMPLATE_SCHEMA.lifecycleChecklists.workplacePrep;
    expect(validateLifecycleChecklist(prepFields, { prep_area_cleared: 'YES' }).valid).toBe(false);
    expect(
      validateLifecycleChecklist(prepFields, {
        prep_area_cleared: 'YES',
        prep_toolbox_meeting: 'YES',
        prep_ppe_verified: 'YES',
      }).valid,
    ).toBe(true);
  });

  it('escapes HTML injection in PDF output and includes simulation watermark', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );

    const html = buildPermitPdfHtml({
      permitId: 'permit-1',
      tenantName: 'PT <script>alert(1)</script>',
      status: 'CLOSED',
      validFrom: new Date('2026-11-17T08:00:00Z'),
      validTo: new Date('2026-11-17T17:00:00Z'),
      timezone: 'Asia/Jakarta',
      heightThresholdMeters: 1.8,
      dataJson: { companyName: '<img src=x onerror=alert(1)>' },
      ptwTemplate: DEFAULT_PTW_TEMPLATE_SCHEMA,
      additionalPermits: [],
      signatures: [],
      transitions: [],
    });

    expect(html).toContain(PDF_WATERMARK_TEXT);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });
});
