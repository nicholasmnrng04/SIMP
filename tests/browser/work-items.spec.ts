import { confirmAction, projectSection } from './ui-navigation';
import { test, expect, type Page } from '@playwright/test';
import { projectInput } from '../support/project-fixture';

async function login(page: Page, role: string) {
  await page.goto('/masuk');
  await page.getByLabel('Email', { exact: true }).fill(`${role}@example.test`);
  await page.getByLabel('Kata sandi', { exact: true }).fill(process.env.SIMP_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Proyek Anda' })).toBeVisible();
}
async function startItem(page: Page, kind: 'GROUP' | 'ITEM', code: string, name: string, parent?: string) {
  await page.getByRole('button', { name: kind === 'GROUP' ? 'Tambah Kelompok' : 'Tambah Pekerjaan', exact: true }).click();
  await page.getByLabel('Kode pekerjaan *', { exact: true }).fill(code);
  await page.getByLabel(kind === 'GROUP' ? 'Nama kelompok *' : 'Nama pekerjaan *', { exact: true }).fill(name);
  if (parent) await page.getByLabel('Kelompok induk', { exact: true }).selectOption({ label: parent });
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Simpan Pekerjaan', exact: true }).click();
  await expect(page.getByText('Pekerjaan berhasil disimpan.', { exact: true })).toBeVisible();
}

test('pekerjaan bertingkat menghitung ulang nilai/bobot, memvalidasi dan melindungi kelompok berturunan', async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'team_leader');
  const me = await (await page.request.get('/api/auth/me')).json();
  const created = await page.request.post('/api/projects', { headers: { origin: 'http://127.0.0.1:5174' }, data: projectInput({ projectCode: `WORK-${info.project.name}-${Date.now()}`, projectName: 'Proyek Bobot UI', teamLeaderId: me.user.id }) });
  expect(created.status()).toBe(201); const project = (await created.json()).project;
  await page.goto(`/proyek/${project.id}`);
  await projectSection(page,'pekerjaan');
  await expect(page.getByRole('heading', { name: 'Belum ada pekerjaan' })).toBeVisible();
  await expect(page.getByText('Bobot belum dapat dihitung', { exact: false })).toBeVisible();
  await startItem(page, 'GROUP', 'I', 'Struktur'); await save(page);
  await startItem(page, 'GROUP', 'I.1', 'Beton', 'I — Struktur'); await save(page);
  await startItem(page, 'ITEM', 'A', 'Item Pertama', 'I.1 — Beton');
  await page.getByLabel('Satuan *', { exact: true }).fill('m³');
  await page.getByLabel('Volume kontrak *', { exact: true }).fill('-1');
  await page.getByLabel('Harga satuan (Rp) *', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Simpan Pekerjaan', exact: true }).click();
  await expect(page.getByText('Volume harus nonnegatif', { exact: false })).toBeVisible();
  await page.getByLabel('Volume kontrak *', { exact: true }).fill('10');
  await page.screenshot({ path: info.outputPath('form-pekerjaan.png'), fullPage: true });
  await save(page);
  await startItem(page, 'ITEM', 'B', 'Item Kedua', 'I — Struktur');
  await page.getByLabel('Satuan *', { exact: true }).fill('m³');
  await page.getByLabel('Volume kontrak *', { exact: true }).fill('20');
  await page.getByLabel('Harga satuan (Rp) *', { exact: true }).fill('100');
  await save(page);
  await expect(page.getByTestId('work-total')).toHaveText('Rp3.000,00');
  await expect(page.getByRole('row', { name: /A Item Pertama/ })).toContainText('33,33%');
  await expect(page.getByRole('row', { name: /B Item Kedua/ })).toContainText('66,67%');
  await expect(page.getByRole('row', { name: /I Struktur/ })).toContainText('Rp3.000,00');
  await page.getByRole('button', { name: 'Ubah A', exact: true }).click();
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.getByLabel('Volume kontrak *', { exact: true }).fill('30'); await save(page);
  await page.reload();
  await expect(page.getByTestId('work-total')).toHaveText('Rp5.000,00');
  await expect(page.getByRole('row', { name: /A Item Pertama/ })).toContainText('60,00%');
  await page.getByRole('button', { name: 'Ubah I', exact: true }).click();
  await expect(page.getByLabel('Kelompok induk', { exact: true }).getByRole('option')).toHaveCount(1);
  await page.getByRole('button', { name: 'Batal', exact: true }).click();
  await page.getByRole('button', { name: 'Hapus I', exact: true }).click();
  await confirmAction(page, 'Hapus pekerjaan');
  await expect(page.getByRole('alert')).toContainText('Kelompok masih memiliki turunan');
  await page.getByRole('button', { name: 'Hapus B', exact: true }).click();
  await confirmAction(page, 'Hapus pekerjaan');
  await expect(page.getByTestId('work-total')).toHaveText('Rp3.000,00');
  await expect(page.getByRole('row', { name: /B Item Kedua/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('pekerjaan-bobot.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('Owner membaca pekerjaan tanpa tindakan edit dan dapat memulihkan koneksi gagal', async ({ page }, info) => {
  await login(page, 'owner');
  await page.goto('/proyek');
  await page.getByRole('link', { name: 'Proyek Penugasan Uji', exact: true }).click();
  await page.route('**/api/projects/*/work-items', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Pekerjaan belum dapat dimuat.' } }) }));
  await projectSection(page,'pekerjaan');
  await expect(page.getByRole('alert')).toContainText('Pekerjaan belum dapat dimuat');
  await page.unroute('**/api/projects/*/work-items');
  await page.getByRole('button', { name: 'Coba Lagi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Daftar Pekerjaan', exact: true })).toBeVisible();
  await expect(page.getByTestId('work-total')).toHaveText('Rp1.000,00');
  for (const name of ['Tambah Kelompok', 'Tambah Pekerjaan', 'Ubah A', 'Hapus A']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('owner-pekerjaan.png'), fullPage: true });
});
