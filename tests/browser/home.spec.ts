import { test, expect } from '@playwright/test';

test('halaman terhubung ke backend nyata pada komputer dan HP', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Terpantau dengan jelas.');
  await expect(page.getByRole('status')).toContainText('Layanan terhubung');
  await page.getByRole('button', { name: 'Periksa Koneksi' }).click();
  await expect(page.getByRole('status')).toContainText('Layanan terhubung');
  expect(await page.locator('html').getAttribute('lang')).toBe('id');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('halaman-awal.png'), fullPage: true });
});

test('kegagalan koneksi dapat dipulihkan melalui tombol Coba Lagi', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Koneksi belum tersedia');
  await page.unroute('**/api/health');
  await page.getByRole('button', { name: 'Coba Lagi' }).click();
  await expect(page.getByRole('status')).toContainText('Layanan terhubung');
});
