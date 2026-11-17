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

test.describe('M2 Session, Scenario Flagging & Scoring', () => {
  test('instructor creates session, participant flags error & finalizes, score updates', async ({
    page,
  }) => {
    await loginAs(page, 'instructor@demo.ptw.local');
    await page.getByTestId('create-session-btn').click();
    const createdBanner = page.getByText(/Sesi baru dibuat dengan kode gabung:/i);
    await expect(createdBanner).toBeVisible({ timeout: 15_000 });
    const bannerText = (await createdBanner.textContent()) ?? '';
    const codeMatch = /kode gabung:\s*([A-Z0-9]+)/i.exec(bannerText);
    const joinCode = codeMatch?.[1] ?? '';
    await expect(page.getByText(`Monitor Real-Time Sesi: ${joinCode}`)).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: /Pantau \(Read-Only\)/i }).first().click();
    await page.waitForURL('**/permits/**');
    const permitUrl = page.url();

    // Applicant flags a seeded error and finalizes
    await loginAs(page, 'applicant@demo.ptw.local');
    await page.goto(permitUrl);
    await page.getByLabel(/Bagian Formulir/i).selectOption('ptw.add_hot_work');
    await page
      .getByLabel(/Alasan/i)
      .fill('Izin kerja panas wajib dilampirkan untuk pengelasan di area proses');
    await page.getByTestId('submit-flag-btn').click();
    await expect(page.locator('code', { hasText: /^ptw\.add_hot_work$/ }).first()).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('finalize-training-btn').click();
    await expect(page.getByTestId('feedback-panel')).toBeVisible();

    // Instructor sees score on dashboard
    await loginAs(page, 'instructor@demo.ptw.local');
    await expect(page.getByTestId('score-Budi Pemohon')).toBeVisible();
  });
});
