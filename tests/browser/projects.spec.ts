import { confirmAction, projectSection } from './ui-navigation';
import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page, email: string) {
  await page.goto('/masuk');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(process.env.SIMP_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Proyek Anda', exact: true })).toBeVisible();
}

test('T10 pencarian terbaru tidak ditimpa respons daftar lama',async({page})=>{
  await signIn(page,'team_leader@example.test');
  let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/projects?*',async route=>{const response=await route.fetch();if(!new URL(route.request().url()).searchParams.get('q'))await gate;await route.fulfill({response});});
  try{
    await page.goto('/proyek');await page.getByLabel('Cari proyek',{exact:true}).fill('tidak-ada-T10-xyz');await page.getByRole('button',{name:'Cari',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Belum ada proyek yang sesuai'})).toBeVisible();
    const oldResponse=page.waitForResponse(r=>r.url().includes('/api/projects?')&&!new URL(r.url()).searchParams.get('q'));release();await (await oldResponse).finished();
    // Give the intentionally stale response time to be parsed and committed by React.
    await page.waitForTimeout(200);await expect(page.getByRole('heading',{name:'Belum ada proyek yang sesuai'})).toBeVisible();
  }finally{release();}
});

test('TL membuat proyek, mengatur tim/status, mencabut akses Inspector dan mengarsipkan', async ({ page, browser }, info) => {
  test.setTimeout(60000);
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page, 'team_leader@example.test');
  await page.goto('/proyek');
  await page.getByRole('link', { name: 'Tambah Proyek' }).click();
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await expect(page.getByText('Kode proyek wajib diisi.')).toBeVisible();
  const title = `Proyek UI ${info.project.name}`, code = `${info.project.name}-${Date.now()}`;
  await page.getByLabel('Kode proyek *', { exact: true }).fill(code);
  await page.getByLabel('Nama pekerjaan *', { exact: true }).fill(title);
  await page.getByLabel('Nama kegiatan', { exact: true }).fill('Perbaikan jalan');
  await page.getByLabel('Lokasi', { exact: true }).fill('Bandung');
  await page.getByLabel('Tahun anggaran').fill('2026');
  await page.getByLabel('Nama instansi', { exact: true }).fill('Instansi Proyek Uji');
  await page.getByLabel('Alamat instansi').fill('Jalan Pengujian 10');
  await page.getByLabel('Nama kontraktor', { exact: true }).fill('PT Pelaksana Proyek');
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.getByLabel('Nilai kontrak awal (Rp)', { exact: true }).fill('-1');
  await page.getByLabel('Tanggal mulai *', { exact: true }).fill('2026-07-16');
  await page.getByLabel('Tanggal selesai *', { exact: true }).fill('2026-07-23');
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await expect(page.getByText('Isi nilai nonnegatif', { exact: false })).toBeVisible();
  await page.getByLabel('Nilai kontrak awal (Rp)', { exact: true }).fill('1000000,25');
  await page.getByLabel('Nilai kontrak berjalan (Rp)', { exact: true }).fill('1200000,50');
  await page.getByLabel('Nomor kontrak', { exact: true }).fill('KONTRAK/UI/001');
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Periksa sebelum menyimpan' })).toBeVisible();
  await page.getByRole('button', { name: 'Simpan Proyek', exact: true }).click();
  await expect(page.getByRole('heading', { name:'Tim & penugasan', exact: true })).toBeVisible();
  const projectUrl = page.url();
  await projectSection(page,'informasi');
  await expect(page.getByText('PT Pelaksana Proyek', { exact: true })).toBeVisible();
  await expect(page.getByText('8 hari (inklusif)', { exact: true })).toBeVisible();
  await expect(page.getByText('Rp1.200.000,50', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ubah Proyek', exact: true }).click();
  await expect(page.getByLabel('Nama kontraktor', { exact: true })).toHaveValue('PT Pelaksana Proyek');
  await page.getByLabel('Nama kontraktor', { exact: true }).fill('PT Pelaksana Diperbarui');
  await page.getByLabel('Lokasi', { exact: true }).fill('Bandung Utara');
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.getByRole('button', { name: 'Simpan Proyek', exact: true }).click();
  await page.reload();
  await expect(page.getByText('PT Pelaksana Diperbarui', { exact: true })).toBeVisible();
  await expect(page.getByText('Bandung Utara', { exact: true }).first()).toBeVisible();
  await projectSection(page,'tim');
  await page.getByRole('button', { name: 'Tambah Anggota', exact: true }).click();
  await page.getByLabel('Pengguna', { exact: true }).selectOption({ label: 'Inspector Pengujian — Inspector' });
  await page.getByRole('button', { name: 'Simpan Penugasan' }).click();
  await expect(page.getByText('Penugasan berhasil disimpan.', { exact: true })).toBeVisible();
  const inspectorContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5174', viewport: page.viewportSize()!, isMobile: info.project.name === 'phone', hasTouch: info.project.name === 'phone' });
  try {
    const inspector = await inspectorContext.newPage();
    await signIn(inspector, 'inspector@example.test');
    await inspector.goto(projectUrl);
    await expect(inspector.getByRole('heading', { name:'Tim & penugasan', exact: true })).toBeVisible();
    await expect(inspector.getByRole('button', { name: 'Ubah Proyek', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Ubah penugasan Inspector Pengujian', exact: true }).click();
    await page.getByLabel('Penugasan aktif', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Simpan Penugasan' }).click();
    await confirmAction(page, 'Simpan penugasan');
    await expect(page.getByRole('row').filter({ hasText: 'Inspector Pengujian' })).toContainText('Tidak aktif saat ini');
    await inspector.reload();
    await expect(inspector.getByRole('alert')).toContainText('tidak ditugaskan kepada Anda');
  } finally { await inspectorContext.close(); }
  await projectSection(page,'informasi');
  await page.getByText('Status dan tindakan proyek',{exact:true}).click();
  await page.getByRole('button', { name: 'Koreksi Status', exact: true }).click();
  await page.getByLabel('Status baru', { exact: true }).selectOption('COMPLETED');
  await page.getByRole('button', { name: 'Simpan Status', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Isi alasan');
  await page.getByLabel('Alasan perubahan', { exact: true }).fill('Pemeriksaan lapangan telah selesai.');
  await page.getByRole('button', { name: 'Simpan Status', exact: true }).click();
  await expect(page.getByText('Koreksi manual: Pemeriksaan lapangan telah selesai.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('detail-proyek.png'), fullPage: true });
  await page.getByRole('button', { name: 'Arsipkan Proyek', exact: true }).click();
  await page.getByLabel('Alasan perubahan', { exact: true }).fill('Proyek demo sudah selesai.');
  await page.getByRole('button', { name: 'Konfirmasi Arsip', exact: true }).click();
  await confirmAction(page, 'Arsipkan proyek');
  await expect(page.getByText('Proyek diarsipkan dan hanya dapat dibaca.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ubah Proyek', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Semua Proyek', exact: false }).click();
  await page.getByLabel('Cari proyek').fill(code);
  await page.getByRole('button', { name: 'Cari', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Belum ada proyek yang sesuai' })).toBeVisible();
  await page.getByLabel('Sertakan arsip').check();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('daftar-proyek.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('Owner hanya melihat proyek/tim yang ditugaskan dan tidak mendapat tombol perubahan', async ({ page }, info) => {
  await signIn(page, 'owner@example.test');
  await page.goto('/proyek');
  await expect(page.getByRole('link', { name: 'Proyek Penugasan Uji', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Proyek Khusus Administrator', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Tambah Proyek' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Proyek Penugasan Uji', exact: true }).click();
  await projectSection(page,'tim');
  await expect(page.getByRole('heading', { name: 'Tim proyek', exact: true })).toBeVisible();
  await expect(page.getByText('Inspector Pengujian', { exact: true })).toBeVisible();
  for (const name of ['Tambah Anggota', 'Ubah Proyek', 'Koreksi Status', 'Arsipkan Proyek']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('owner-proyek.png'), fullPage: true });
});

test('Administrator menetapkan TL/Owner dan mengatur periode TL', async ({ page }, info) => {
  test.setTimeout(60000);
  await signIn(page, 'admin@example.test');
  await page.goto('/proyek/baru');
  const title = `Proyek Administrator ${info.project.name}`;
  await page.getByLabel('Kode proyek *', { exact: true }).fill(`ADMIN-${info.project.name}-${Date.now()}`);
  await page.getByLabel('Nama pekerjaan *', { exact: true }).fill(title);
  await page.getByLabel('Team Leader', { exact: true }).selectOption({ label: 'Team Leader Pengujian' });
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.getByLabel('Tanggal mulai *', { exact: true }).fill('2026-07-16');
  await page.getByLabel('Tanggal selesai *', { exact: true }).fill('2026-07-23');
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.getByRole('button', { name: 'Simpan Proyek', exact: true }).click();
  await expect(page.getByRole('heading', { name:'Tim & penugasan', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tambah Anggota', exact: true }).click();
  await page.getByLabel('Pengguna', { exact: true }).selectOption({ label: 'Owner Pengujian — Owner' });
  await page.getByRole('button', { name: 'Simpan Penugasan', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Owner Pengujian' })).toContainText('Aktif saat ini');
  await page.getByRole('button', { name: 'Ubah penugasan Team Leader Pengujian', exact: true }).click();
  await page.getByLabel('Mulai penugasan', { exact: true }).fill('2099-01-01');
  await page.getByRole('button', { name: 'Simpan Penugasan', exact: true }).click();
  await confirmAction(page, 'Simpan penugasan');
  await expect(page.getByRole('row').filter({ hasText: 'Team Leader Pengujian' })).toContainText('Tidak aktif saat ini');
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: 'Team Leader Pengujian' })).toContainText('2099-01-01');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('admin-tim.png'), fullPage: true });
});
