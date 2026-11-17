import { expect, test, type Page } from '@playwright/test';

async function loginAs(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata Sandi').fill('SimulasiPtw2026!');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL('**/dashboard/**');
  await expect(page.getByTestId('role-badge')).toBeVisible();
}

async function signCanvas(page: Page, canvasLabel: string, saveBtnTestId: string) {
  const canvas = page.getByLabel(canvasLabel);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`Canvas ${canvasLabel} not visible`);
  await page.mouse.move(box.x + 20, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 70);
  await page.mouse.up();
  await page.getByTestId(saveBtnTestId).click();
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

test.describe('M1 Full Permit Lifecycle (DRAFT -> CLOSED) & PDF', () => {
  test('runs one permit from DRAFT to CLOSED across roles and generates watermarked PDF', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    // 1. APPLICANT creates and fills PTW, HOT_WORK additional permit, JSA, signature, and submits
    await loginAs(page, 'applicant@demo.ptw.local');
    await page.getByTestId('create-permit-btn').click();
    await page.waitForURL(/\/permits\/(?!new)[^/]+$/);
    const permitUrl = page.url();
    const permitId = permitUrl.split('/').pop()!;

    await page.getByLabel(/Nama Perusahaan/i).fill('PT Kontraktor Simulasi');
    await page.getByLabel(/Departemen Pengguna/i).fill('Pemeliharaan');
    await page.locator('#workLocation').fill('Unit Tangki T-101');
    await page.getByLabel(/Uraian Kerja/i).fill('Pengelasan pipa penyangga');

    const now = new Date();
    const startIso = toLocalDateTimeInput(new Date(now.getTime() - 15 * 60 * 1000));
    const endIso = toLocalDateTimeInput(new Date(now.getTime() + 4 * 60 * 60 * 1000));
    await page.getByLabel(/Tanggal \/ Jam Mulai/i).fill(startIso);
    await page.getByLabel(/Tanggal \/ Jam Selesai/i).fill(endIso);

    // Checklist 1-8: answer YES
    for (let i = 1; i <= 8; i++) {
      await page.locator(`input[name="chk_${i}_${['trained_workers', 'competent_supervisor', 'has_sop', 'jsa_attached', 'emergency_plan', 'equipment_safe', 'registered_special_equipment', 'communicated'][i - 1]}"][value="YES"]`).check();
    }

    // Additional permits: NO for first 4, YES for HOT_WORK
    for (const key of ['add_loto', 'add_height', 'add_b3_excavation', 'add_confined_space']) {
      await page.locator(`input[name="${key}"][value="NO"]`).check();
    }
    await page.locator('input[name="add_hot_work"][value="YES"]').check();
    await page.getByLabel(/Kerja Panas.*notes/i).fill('Pengelasan pipa baja');

    // High risk hazards: NO
    for (const key of [
      'haz_fire',
      'haz_sparks',
      'haz_dust_chemical',
      'haz_energy',
      'haz_height_opening',
      'haz_restricted_access',
    ]) {
      await page.locator(`input[name="${key}"][value="NO"]`).check();
    }

    await page.getByTestId('save-draft-btn').click();
    await expect(page.getByText('Sub-Formulir Izin Tambahan')).toBeVisible();

    // Fill auto-created HOT_WORK sub-form
    await page.getByLabel(/Metode Kerja Panas/i).fill('Las Listrik SMAW');
    await page.getByLabel(/Hasil Uji Gas LEL/i).fill('0');
    await page.locator('input[name="fireWatcherAssigned"][value="YES"]').check();
    await page.getByTestId('save-additional-HOT_WORK').click();

    // Fill JSA
    await page.getByLabel('Nama Pengawas').fill('Sari Pengawas');
    await page.getByLabel('Kontraktor').fill('PT Kontraktor Simulasi');
    await page.locator('#jsa-location').fill('Unit Tangki T-101');
    await page.getByPlaceholder('Aktivitas 1').fill('Pengelasan sambungan pipa');
    await page.getByPlaceholder('Bahaya potensial').fill('Percikan api & asap las');
    await page.getByPlaceholder('Prosedur kerja aman').fill('Pasang tirai las, APAR & Fire Watcher');
    await page.getByPlaceholder('Nama Anggota Kru').fill('Budi');
    await page.getByTestId('save-jsa-btn').click();

    // Sign as APPLICANT and submit
    await signCanvas(
      page,
      'Tanda Tangan Penerima Izin (APPLICANT)',
      'save-signature-tanda-tangan-penerima-izin-(applicant)',
    );
    await expect(page.getByAltText('Tanda Tangan Penerima Izin (APPLICANT)')).toBeVisible();
    await page.getByTestId('submit-permit-btn').click();
    await expect(page.getByTestId('permit-status-badge')).toContainText('Diajukan');

    // 2. SUPERVISOR reviews & forwards to ISSUER
    await loginAs(page, 'supervisor@demo.ptw.local');
    await page.goto(permitUrl);
    await page.getByLabel(/Catatan Review Metode/i).fill('Metode pengelasan dan isolasi area telah ditinjau.');
    await page.getByTestId('supervisor-approve-btn').click();
    await expect(page.getByTestId('permit-status-badge')).toContainText('Menunggu Penerbitan');

    // 3. ISSUER approves HOT_WORK, signs, and issues permit
    await loginAs(page, 'issuer@demo.ptw.local');
    await page.goto(permitUrl);
    await page.getByTestId('approve-additional-HOT_WORK').click();
    await expect(page.getByText('Izin tambahan APPROVED.')).toBeVisible();
    await signCanvas(
      page,
      'Tanda Tangan Pemberi Izin (ISSUER)',
      'save-signature-tanda-tangan-pemberi-izin-(issuer)',
    );
    await expect(page.getByAltText('Tanda Tangan Pemberi Izin (ISSUER)')).toBeVisible();
    await page.getByTestId('issuer-issue-btn').click();
    await expect(page.getByTestId('permit-status-badge')).toContainText('Disetujui');

    // 4. APPLICANT completes FR-35 workplace prep checklist and activates permit
    await loginAs(page, 'applicant@demo.ptw.local');
    await page.goto(permitUrl);
    for (const key of ['prep_area_cleared', 'prep_toolbox_meeting', 'prep_ppe_verified']) {
      await page.locator(`input[name="${key}"][value="YES"]`).check();
    }
    await page.getByTestId('activate-permit-btn').click();
    await expect(page.getByTestId('permit-status-badge')).toContainText('Aktif');

    // 5. COORDINATOR adds supervision note
    await loginAs(page, 'coordinator@demo.ptw.local');
    await page.goto(permitUrl);
    await page.getByLabel('Catatan Pengawasan Lapangan').fill('Pengawasan berkala aman, LEL 0%.');
    await page.getByTestId('add-supervision-note-btn').click();
    await expect(page.getByText('Pengawasan berkala aman, LEL 0%.')).toBeVisible();

    // 6. APPLICANT completes FR-35 post-work inspection checklist
    await loginAs(page, 'applicant@demo.ptw.local');
    await page.goto(permitUrl);
    for (const key of ['post_housekeeping', 'post_equipment_safe', 'post_crew_signed_out']) {
      await page.locator(`input[name="${key}"][value="YES"]`).check();
    }
    await page.getByTestId('complete-permit-btn').click();
    await expect(page.getByTestId('permit-status-badge')).toContainText('Selesai');

    // 7. ISSUER verifies and closes permit, and verifies PDF endpoint
    await loginAs(page, 'issuer@demo.ptw.local');
    await page.goto(permitUrl);
    await page.getByTestId('close-permit-btn').click();
    await expect(page.getByTestId('permit-status-badge')).toContainText('Ditutup');

    const pdfResponse = await page.request.get(`/api/permits/${permitId}/pdf`);
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
    const pdfBody = await pdfResponse.body();
    expect(pdfBody.byteLength).toBeGreaterThan(1000);
  });
});
