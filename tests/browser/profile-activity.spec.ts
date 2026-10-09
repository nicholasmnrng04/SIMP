import { test, expect } from '@playwright/test';

const password = process.env.SIMP_TEST_PASSWORD!;

for (const role of ['ADMINISTRATOR', 'TEAM_LEADER', 'OWNER', 'ENGINEER', 'INSPECTOR'] as const) {
  test(`${role} dapat membuka profil dan hanya role pengawas melihat Aktivitas`, async ({ page }, info) => {
    await page.goto('/masuk');
    await page.getByLabel('Email', { exact: true }).fill(role === 'ADMINISTRATOR' ? 'admin@example.test' : `${role.toLowerCase()}@example.test`);
    await page.getByLabel('Kata sandi', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Proyek Anda' })).toBeVisible();
    await page.getByRole('link', { name: 'Profil' }).click();
    await expect(page.getByRole('heading', { name: 'Profil saya' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Panduan penggunaan' })).toBeVisible();
    await expect(page.getByLabel('Nama lengkap')).not.toBeEmpty();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`profil-${role}.png`), fullPage: true });
    if (role === 'ADMINISTRATOR' || role === 'TEAM_LEADER') {
      await page.goto('/aktivitas');
      await expect(page.getByRole('heading', { name: 'Aktivitas', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Riwayat aktivitas' })).toBeVisible();
      if (role === 'TEAM_LEADER') await expect(page.getByText('Proyek Khusus Administrator')).toHaveCount(0);
      expect((await page.request.get('/api/activity')).status()).toBe(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`aktivitas-${role}.png`), fullPage: true });
    } else {
      expect((await page.request.get('/api/activity')).status()).toBe(403);
      await page.goto('/aktivitas');
      await expect(page.getByRole('heading', { name: 'Akses tidak tersedia' })).toBeVisible();
    }
  });
}
