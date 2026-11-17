import { expect, test } from '@playwright/test';

test.describe('M3 PWA Manifest, i18n Switcher & QR Verify', () => {
  test('serves PWA manifest, switches language ID <-> EN, and opens tenant-admin settings', async ({
    page,
  }) => {
    const manifestRes = await page.request.get('/manifest.webmanifest');
    expect(manifestRes.status()).toBe(200);
    const manifestJson = await manifestRes.json();
    expect(manifestJson.short_name).toBe('Simulator PTW');

    await page.goto('/login');
    await expect(page.getByRole('banner')).toContainText('Alat Pelatihan — Data Simulasi');

    await page.getByTestId('lang-en').click();
    await page.waitForURL('**/en/login');
    await expect(page.getByRole('banner')).toContainText('Training Tool — Simulation Data');

    await page.getByTestId('lang-id').click();
    await page.waitForURL('**/login');
    await expect(page.getByRole('banner')).toContainText('Alat Pelatihan — Data Simulasi');

    // Login as TENANT_ADMIN and verify settings form
    await page.getByLabel('Email').fill('admin@demo.ptw.local');
    await page.getByLabel('Kata Sandi').fill('SimulasiPtw2026!');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL('**/dashboard/tenant-admin');
    await expect(page.getByTestId('save-tenant-settings-btn')).toBeVisible();
  });
});
