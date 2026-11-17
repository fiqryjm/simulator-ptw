import { expect, test } from '@playwright/test';

test.describe('M0 Authentication & Role Dashboards', () => {
  test('displays training banner and logs in as APPLICANT', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('banner')).toContainText('Alat Pelatihan — Data Simulasi');

    await page.getByLabel('Email').fill('applicant@demo.ptw.local');
    await page.getByLabel('Kata Sandi').fill('SimulasiPtw2026!');
    await page.getByRole('button', { name: 'Masuk' }).click();

    await page.waitForURL('**/dashboard/applicant');
    await expect(page.getByTestId('role-badge')).toContainText('APPLICANT');

    // Attempting to visit INSTRUCTOR dashboard redirects back to APPLICANT dashboard
    await page.goto('/dashboard/instructor');
    await page.waitForURL('**/dashboard/applicant');
  });
});
