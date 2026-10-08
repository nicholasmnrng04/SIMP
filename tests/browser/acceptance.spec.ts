import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { dayIndex, dateAt } from '../../shared/plans';
import { confirmAction } from './ui-navigation';

// All business writes in this scenario go through UI forms. API calls only
// verify results/authorization; the runner supplies the bootstrap administrator.
test('T11 alur lengkap lima role dari akun baru sampai monitoring dan koreksi', async ({ page }, info) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });
  const suffix = `${info.project.name}-${Date.now()}`;
  const password = process.env.SIMP_TEST_PASSWORD!;
  const roles = ['TEAM_LEADER', 'ENGINEER', 'INSPECTOR', 'OWNER'] as const;
  const labels = ['Team Leader', 'Engineer', 'Inspector', 'Owner'];
  const email = (role: string) => `${role.toLowerCase()}-${suffix}@example.test`;
  const click = (name: string) => page.getByRole('button', { name, exact: true }).click();
  const fill = (name: string, value: string) => page.getByLabel(name, { exact: true }).fill(value);
  async function login(address: string, first = false) {
    if (!first) await click('Keluar');
    await page.goto('/masuk'); await fill('Email', address); await fill('Kata sandi', password); await click('Masuk');
    await expect(page.getByRole('heading', { name: 'Proyek Anda', exact: true })).toBeVisible();
  }
  async function publish() {
    await click('Lanjut ke Target'); await click('Bagi Rata Pekerjaan Ini');
    await click('Periksa Rencana'); await click('Tetapkan Rencana');
    await expect(page.getByText('Rencana berhasil diterbitkan.', { exact: true })).toBeVisible();
  }
  async function submit() {
    await click('Periksa Sebelum Kirim'); await click('Kirim untuk Diperiksa');
    await expect(page.getByRole('button', { name: 'Ubah Laporan', exact: true })).toHaveCount(0);
  }
  async function approve() {
    await click('Setujui Laporan'); await confirmAction(page, 'Setujui laporan'); await expect(page.getByText('Laporan berhasil disetujui.', { exact: true })).toBeVisible();
  }
  await login('admin@example.test', true);
  await page.getByRole('link',{name:'Kelola Pengguna',exact:true}).click();
  for (const role of roles) {
    await click('Tambah Pengguna'); await fill('Nama lengkap', `${role} ${suffix}`);
    await fill('Email', email(role)); await fill('Kata sandi awal', password);
    await page.getByLabel('Peran pengguna').selectOption(role); await click('Simpan Pengguna');
    await expect(page.getByRole('row').filter({ hasText: email(role) })).toBeVisible();
  }
  await login(email('TEAM_LEADER'));
  const me = await (await page.request.get('/api/auth/me')).json();
  // Match the project's default business timezone.
  await page.goto('/proyek'); await page.getByRole('link', { name: 'Tambah Proyek' }).click();
  await fill('Kode proyek *', `DEMO-${suffix}`); await fill('Nama pekerjaan *', `Demo T11 ${suffix}`);
  await fill('Lokasi', 'Lokasi demonstrasi'); await click('Lanjut');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const end = dateAt(dayIndex(today) + 13);
  await fill('Tanggal mulai *', today); await fill('Tanggal selesai *', end);
  await fill('Nilai kontrak awal (Rp)', '100000'); await fill('Nilai kontrak berjalan (Rp)', '100000');
  await click('Lanjut'); await click('Simpan Proyek');
  await expect(page.getByRole('heading', { name: 'Tim & penugasan', exact: true })).toBeVisible();
  const projectUrl = page.url(), id = new URL(projectUrl).pathname.split('/')[2];
  const root = `/api/projects/${id}`;
  // Owner assignment belongs to Administrator; TL assigns technical members.
  await login('admin@example.test'); await page.goto(projectUrl);
  await click('Tambah Anggota');
  await page.getByLabel('Pengguna', { exact: true }).selectOption({ label: `OWNER ${suffix} — Owner` });
  await click('Simpan Penugasan'); await expect(page.getByRole('button', { name: 'Simpan Penugasan', exact: true })).toHaveCount(0);
  await login(email('TEAM_LEADER')); await page.goto(projectUrl);
  for (let i = 1; i < 3; i++) {
    await click('Tambah Anggota');
    await page.getByLabel('Pengguna', { exact: true }).selectOption({ label: `${roles[i]} ${suffix} — ${labels[i]}` });
    await click('Simpan Penugasan');
    await expect(page.getByRole('button', { name: 'Simpan Penugasan', exact: true })).toHaveCount(0);
    await expect(page.getByText('Penugasan berhasil disimpan.', { exact: true })).toBeVisible();
  }
  await page.goto(`/proyek/${id}/pekerjaan`);
  await click('Tambah Pekerjaan'); await fill('Kode pekerjaan *', 'A'); await fill('Nama pekerjaan *', 'Galian demo'); await click('Lanjut');
  await fill('Satuan *', 'm'); await fill('Volume kontrak *', '1000'); await fill('Harga satuan (Rp) *', '100');
  await click('Simpan Pekerjaan'); await expect(page.getByTestId('work-total')).toHaveText('Rp100.000,00');
  await page.goto(`/proyek/${id}/rencana`); await click('Buat Rencana Awal'); await publish();
  await expect(page.getByRole('heading', { name: 'V1 · Rencana Awal', exact: true })).toBeVisible();

  await login(email('INSPECTOR')); await page.goto(`/proyek/${id}/laporan`); await click('Buat Laporan Harian');
  await fill('Tanggal laporan', today);
  await page.getByLabel('Pekerjaan 1', { exact: true }).selectOption({ label: 'A · Galian demo (m)' });
  await fill('Uraian kegiatan 1', 'Penggalian tahap pertama'); await fill('Volume kegiatan 1', '250');
  await fill('Lokasi kegiatan 1', 'Zona A'); await click('Lanjut');
  await click('Tambah Tenaga Kerja'); await page.getByLabel('Jenis tenaga kerja 1', { exact: true }).selectOption('Operator');
  await fill('Jumlah orang 1', '3'); await click('Tambah Cuaca'); await click('Lanjut');
  await click('Tambah Material atau Alat'); await fill('Nama material atau alat 1', 'Pasir');
  await fill('Jumlah material 1', '5'); await fill('Satuan material 1', 'm3');
  await click('Tambah Masalah'); await fill('Uraian masalah 1', 'Akses berlumpur');
  await fill('Penyelesaian 1', 'Perbaikan akses sementara'); await click('Lanjut');
  await fill('Catatan umum', 'Data sintetis untuk demonstrasi'); await click('Simpan & Lanjut ke Foto');
  await expect(page.getByRole('heading', { name: 'LH-00001', exact: true })).toBeVisible();
  const route = page.url(), reportId = route.split('/').at(-1)!;
  const png = await sharp({ create: { width: 320, height: 180, channels: 3, background: '#397860' } }).png().toBuffer();
  await page.getByLabel('Berkas foto', { exact: true }).setInputFiles({ name: 'demo.png', mimeType: 'image/png', buffer: png });
  await fill('Keterangan foto', 'Foto demo T11'); await click('Unggah Foto');
  await expect(page.getByRole('img', { name: 'Foto demo T11', exact: true })).toBeVisible(); await submit();
  await login(email('ENGINEER')); await page.goto(route);
  await fill('Catatan pemeriksaan teknis', 'Periksa kembali volume'); await click('Simpan Catatan Engineer');
  await expect(page.getByText('Catatan pemeriksaan tersimpan.', { exact: true })).toBeVisible();
  const detail = await (await page.request.get(`${root}/reports/${reportId}`)).json();
  expect((await page.request.post(`${root}/reports/${reportId}/reviews`, { headers: { origin: 'http://127.0.0.1:5174' }, data: { editVersion: detail.editVersion, kind: 'APPROVE', note: '' } })).status()).toBe(403);
  await login(email('TEAM_LEADER')); await page.goto(route);
  await fill('Catatan keputusan (wajib untuk perbaikan)', 'Lengkapi catatan pengukuran'); await click('Minta Perbaikan');
  await expect(page.getByText('Permintaan perbaikan tersimpan.', { exact: true })).toBeVisible();
  await login(email('INSPECTOR')); await page.goto(route); await click('Ubah Laporan');
  await fill('Catatan kegiatan 1', 'Volume telah diukur ulang'); await click('Simpan Sementara'); await submit();
  await login(email('TEAM_LEADER')); await page.goto(route); await approve();
  const progress = async () => (await (await page.request.get(`${root}/progress`)).json()).total.actual.cumulative;
  expect(await progress()).toBe('25.000000');
  await page.goto(`/proyek/${id}/rencana`); await click('Buat Perubahan Rencana');
  await fill('Tanggal berlaku', dateAt(dayIndex(today) + 1)); await fill('Alasan', 'Penyesuaian jadwal demo');
  await page.getByLabel('Sumber target', { exact: true }).selectOption('MONTHLY'); await publish();
  expect(await progress()).toBe('25.000000');
  await login(email('INSPECTOR')); await page.goto(route); await page.getByText('Koreksi laporan disetujui',{exact:true}).first().click(); await fill('Alasan koreksi', 'Volume final hasil pemeriksaan 200'); await click('Buat Koreksi');
  await expect(page).not.toHaveURL(route); const correctionRoute = page.url();
  await click('Ubah Laporan'); await fill('Volume kegiatan 1', '200'); await click('Simpan Sementara'); await submit();
  await login(email('OWNER')); expect(await progress()).toBe('25.000000');
  expect((await page.request.get(`${root}/reports/${correctionRoute.split('/').at(-1)}`)).status()).toBe(404);
  await login(email('TEAM_LEADER')); await page.goto(correctionRoute); await approve(); expect(await progress()).toBe('20.000000');
  await login(email('OWNER')); await page.goto(`/proyek/${id}/ringkasan`);
  await expect(page.locator('.monitor-cards')).toContainText('20,00%');
  await page.getByText('Grafik rencana dan capaian',{exact:true}).click();
  await expect(page.getByRole('img', { name: 'Grafik Rencana Awal, Rencana Terbaru dan Capaian' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('t11-owner-monitoring.png'), fullPage: true });
  for (const type of ['WEEKLY', 'MONTHLY']) {
    const period = await (await page.request.get(`${root}/period-reports?type=${type}&period=1`)).json();
    expect(period.progress.total.actual.cumulative).toBe('20.000000');
  }
  await page.goto(correctionRoute); await page.getByText('Riwayat pemeriksaan dan versi',{exact:true}).click(); await page.getByRole('link', { name: 'Versi 1', exact: true }).click();
  await expect(page.getByText('Versi 1 · Arsip versi disetujui, telah digantikan', { exact: true })).toBeVisible();
  const photo = page.getByRole('img', { name: 'Foto demo T11', exact: true });
  await photo.scrollIntoViewIfNeeded(); await expect.poll(() => photo.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  // An otherwise valid Inspector account has no assignment to this new project.
  await login('inspector@example.test'); await page.goto(projectUrl);
  await expect(page.getByRole('alert')).toContainText('tidak ditugaskan kepada Anda');
  expect((await page.request.get(`${root}/exports?kind=PROGRESS&format=xlsx`)).status()).toBe(404);
  expect(me.user.role).toBe('TEAM_LEADER'); expect(errors).toEqual([]);
});
