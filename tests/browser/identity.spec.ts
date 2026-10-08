import { test, expect, type Page } from '@playwright/test';
import { confirmAction } from './ui-navigation';

const password = process.env.SIMP_TEST_PASSWORD!;
async function signIn(page: Page, email: string, secret = password) {
  await page.goto('/masuk');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
}

test('Administrator masuk, memvalidasi, menyimpan, mengubah dan menonaktifkan pengguna', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page, 'admin@example.test', 'SandiTidakBenar');
  await expect(page.getByRole('alert')).toContainText('Email atau kata sandi tidak sesuai');
  await page.screenshot({ path: info.outputPath('masuk.png'), fullPage: true });
  await page.getByLabel('Kata sandi', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading',{name:'Proyek Anda',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Kelola Pengguna',exact:true}).click();
  await expect(page.getByRole('heading', { name: 'Pengguna', exact: true })).toBeVisible();
  const name = `Petugas ${info.project.name}`;
  const email = `${info.project.name}-${Date.now()}@example.test`;
  await page.getByRole('button', { name: 'Tambah Pengguna' }).click();
  await page.getByRole('button', { name: 'Simpan Pengguna' }).click();
  await expect(page.locator('#user-name-error')).toBeVisible();
  await page.getByLabel('Nama lengkap').fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Kata sandi awal').fill(password);
  await page.getByRole('button', { name: 'Simpan Pengguna' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Data pengguna berhasil disimpan.' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: email });
  await expect(row).toContainText('Inspector');
  await page.getByLabel('Cari pengguna').fill('tidak-ada-pengguna-ini');
  await expect(page.getByText('Tidak ada pengguna yang cocok')).toBeVisible();
  await page.getByLabel('Cari pengguna').fill(name);
  await row.getByRole('button', { name: `Ubah ${name}` }).click();
  await page.getByLabel('Peran pengguna').selectOption('ENGINEER');
  await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
  await confirmAction(page, 'Simpan perubahan');
  await expect(row).toContainText('Engineer');
  await page.reload();
  await expect(row).toContainText('Engineer');
  await row.getByRole('button', { name: `Ubah ${name}` }).click();
  await page.getByLabel('Akun aktif').uncheck();
  await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
  await confirmAction(page, 'Simpan perubahan');
  await expect(row).toContainText('Nonaktif');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('pengguna.png'), fullPage: true });
  // Cookie sesi lama juga harus ditolak sesudah keluar dari browser.
  const session = (await page.context().cookies()).find((cookie) => cookie.name === 'simp_session');
  expect(session?.httpOnly).toBe(true);
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Masuk ke aplikasi' })).toBeVisible();
  const revoked = await page.request.get('/api/auth/me', { headers: { cookie: `simp_session=${session!.value}` } });
  expect(revoked.status()).toBe(401);
  await signIn(page, email);
  await expect(page.getByRole('alert')).toContainText('akun tidak aktif');
  expect(errors).toEqual([]);
});

for (const role of ['OWNER', 'TEAM_LEADER', 'ENGINEER', 'INSPECTOR']) {
  test(`${role} mendapat ruang kerja dan tidak dapat membuka administrasi`, async ({ page }, info) => {
    await signIn(page, `${role.toLowerCase()}@example.test`);
    await expect(page.getByRole('heading', { name: 'Proyek Anda' })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Pengguna' })).toHaveCount(0);
    expect((await page.request.get('/api/users')).status()).toBe(403);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (role === 'INSPECTOR') await page.screenshot({ path: info.outputPath('ruang-kerja.png'), fullPage: true });
    await page.goto('/pengguna');
    await expect(page.getByRole('heading', { name: 'Akses tidak tersedia' })).toBeVisible();
  });
}

test('kegagalan memeriksa sesi menyediakan tombol pemulihan', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Layanan belum siap.' } }) }));
  await page.goto('/masuk');
  await expect(page.getByRole('alert')).toContainText('Layanan belum siap');
  await page.unroute('**/api/auth/me');
  await page.getByRole('button', { name: 'Coba Lagi' }).click();
  await expect(page.getByRole('heading', { name: 'Masuk ke aplikasi' })).toBeVisible();
});
