import { test, expect, type Page } from '@playwright/test';

async function login(page:Page, role:string) {
  await page.goto('/masuk');
  await page.getByLabel('Email',{exact:true}).fill(`${role}@example.test`);
  await page.getByLabel('Kata sandi',{exact:true}).fill(process.env.SIMP_TEST_PASSWORD!);
  await page.getByRole('button',{name:'Masuk',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Proyek Anda',exact:true})).toBeVisible();
}
async function section(page:Page, value:string, label:string) {
  if((page.viewportSize()?.width??1280)<=720)await page.getByRole('button',{name:'Buka navigasi',exact:true}).click();
  await page.getByRole('navigation',{name:'Bagian proyek',exact:true}).getByRole('link',{name:label,exact:true}).click();
}
for(const role of ['admin','owner','team_leader','engineer','inspector'])test(`UI proyek dahulu dan akses ${role}`,async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await login(page,role);
  await expect(page.getByText('Akun Anda siap digunakan')).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 1280) <= 720) await page.getByRole('button', { name: 'Buka navigasi', exact: true }).click();
  await expect(page.getByRole('navigation',{name:'Navigasi utama'}).getByRole('link',{name:'Pengguna',exact:true})).toHaveCount(role==='admin'?1:0);
  await page.getByLabel('Pilih proyek aktif',{exact:true}).selectOption({label:'Proyek Penugasan Uji'});
  await expect(page.getByRole('heading',{name:'Ringkasan proyek',exact:true})).toBeVisible();
  const root=new URL(page.url()).pathname;
  if ((page.viewportSize()?.width ?? 1280) <= 720) await expect(page.getByRole('link', { name: '← Semua proyek', exact: true })).toBeVisible();
  await expect(page.locator('.project-name')).toHaveText('Proyek Penugasan Uji');
  await expect(page.getByRole('button',{name:'Arsipkan Proyek',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`ringkasan-${role}.png`),fullPage:true});
  await section(page,'laporan','Laporan Harian');
  await expect(page.getByRole('heading',{name:'Laporan Harian',exact:true})).toBeVisible();
  const expected=role==='inspector'?'Perlu saya selesaikan':['team_leader','engineer'].includes(role)?'Menunggu pemeriksaan':'Semua laporan';
  await expect(page.getByRole('button',{name:expected,exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Semua laporan',exact:true}).click();
  await expect(page).toHaveURL(/view=all/);await page.reload();
  await expect(page.getByRole('button',{name:'Semua laporan',exact:true})).toHaveAttribute('aria-pressed','true');
  if(role==='inspector'){
    await page.getByRole('link',{name:'Buka Laporan',exact:true}).first().click();
    await expect(page.getByRole('list',{name:'Tahap laporan'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Periksa Sebelum Kirim',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Setujui Laporan',exact:true})).toHaveCount(0);
  }
  await section(page,'pekerjaan','Daftar Pekerjaan');
  await expect(page.getByRole('heading',{name:'Daftar Pekerjaan',exact:true})).toBeVisible();
  await section(page,'rencana','Jadwal & Target');
  await expect(page.getByRole('heading',{name:'Jadwal & target',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Buat Perubahan Rencana',exact:true})).toHaveCount(role==='team_leader'?1:0);
  await section(page,'dokumentasi','Dokumentasi');
  await expect(page.getByRole('heading',{name:'Dokumentasi',exact:true})).toBeVisible();
  await section(page,'tim','Tim');
  await expect(page.getByRole('heading',{name:'Tim & penugasan',exact:true})).toBeVisible();
  await section(page,'informasi','Informasi Proyek');
  await expect(page.getByRole('heading',{name:'Informasi proyek',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Ubah Proyek',exact:true})).toHaveCount(['admin','team_leader'].includes(role)?1:0);
  await page.goto(`${root}/ringkasan`);await expect(page.getByRole('heading',{name:'Ringkasan proyek',exact:true})).toBeVisible();
  await page.goto(`${root}/progress`);await expect(page.getByRole('heading',{name:'Rincian kemajuan',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('filter proyek dan laporan mengikuti URL, kembali, dan kegagalan',async({page})=>{
  await login(page,'team_leader');await page.goto('/proyek');
  await page.getByLabel('Cari proyek',{exact:true}).fill('BROWSER-SEED');await page.getByRole('button',{name:'Cari',exact:true}).click();
  await expect(page.getByRole('link',{name:'Proyek Penugasan Uji',exact:true})).toBeVisible();
  await page.getByLabel('Cari proyek',{exact:true}).fill('tidak-ada-proyek');await page.getByRole('button',{name:'Cari',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Belum ada proyek yang sesuai'})).toBeVisible();await page.goBack();
  await expect(page.getByLabel('Cari proyek',{exact:true})).toHaveValue('BROWSER-SEED');
  await page.getByRole('link',{name:'Proyek Penugasan Uji',exact:true}).click();await section(page,'laporan','Laporan Harian');
  await page.getByRole('button',{name:'Semua laporan',exact:true}).click();await expect(page.getByRole('link',{name:'Buka Laporan',exact:true})).not.toHaveCount(0);
  await page.getByRole('button',{name:'Menunggu pemeriksaan',exact:true}).click();await expect(page.getByRole('heading',{name:'Belum ada laporan yang dapat ditampilkan'})).toBeVisible();
  await page.goBack();await expect(page.getByRole('button',{name:'Semua laporan',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.route('**/api/projects/*/reports?*',route=>route.fulfill({status:503,json:{error:{message:'Koneksi uji terputus.'}}}));
  await page.getByRole('button',{name:'Menunggu pemeriksaan',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Koneksi uji terputus.');
  await page.unroute('**/api/projects/*/reports?*');await page.getByRole('button',{name:'Coba Lagi',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);
});

test('tautan rencana, kemajuan, rekap dan unduhan memulihkan pilihan',async({page})=>{
  test.setTimeout(60000);
  await login(page,'owner');
  const projects=await(await page.request.get('/api/projects?q=BROWSER-SEED')).json();
  const project=projects.projects[0],root=`/proyek/${project.id}`;
  await page.goto(`${root}/rencana`);
  await page.getByText('Riwayat dan perbandingan rencana',{exact:true}).click();
  await page.getByLabel('Tampilan periode',{exact:true}).selectOption('MONTHLY');
  await expect(page).toHaveURL(/type=MONTHLY/);await page.reload();
  await page.getByText('Riwayat dan perbandingan rencana',{exact:true}).click();
  await expect(page.getByLabel('Tampilan periode',{exact:true})).toHaveValue('MONTHLY');
  await page.goto(`${root}/progress?from=${project.startDate}&cutoff=${project.endDate}`);
  await expect(page.getByLabel('Awal periode',{exact:true})).toHaveValue(project.startDate);
  await expect(page.getByLabel('Sampai tanggal',{exact:true})).toHaveValue(project.endDate);
  await page.getByRole('link',{name:'Pratinjau cetak / Unduh',exact:true}).click();
  await expect(page.getByLabel('Awal periode',{exact:true})).toHaveValue(project.startDate);
  await expect(page.getByLabel('Sampai tanggal',{exact:true})).toHaveValue(project.endDate);
  await page.getByRole('button',{name:'Tampilkan Laporan',exact:true}).click();
  await expect(page.getByRole('button',{name:'Unduh PDF',exact:true})).toBeEnabled();
  await expect(page.getByRole('img',{name:/Layout workbook/}).first()).not.toBeVisible();
  await page.getByText('Pratinjau cetak',{exact:true}).click();
  await expect(page.getByRole('img',{name:/Layout workbook/}).first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByLabel('Jenis laporan',{exact:true}).selectOption('WORKFORCE');
  await expect(page.getByRole('button',{name:'Unduh PDF',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Tampilkan Laporan',exact:true}).click();
  await expect(page.getByRole('button',{name:'Unduh PDF',exact:true})).toBeEnabled();
  await page.reload();await expect(page.getByLabel('Jenis laporan',{exact:true})).toHaveValue('WORKFORCE');
  await expect(page.getByRole('button',{name:'Unduh PDF',exact:true})).toBeEnabled();
  await page.goBack();await expect(page.getByLabel('Jenis laporan',{exact:true})).toHaveValue('PROGRESS');
  await expect(page.getByRole('button',{name:'Unduh PDF',exact:true})).toBeEnabled();
  await page.goto(`${root}/laporan-berkala?type=MONTHLY&period=1`);
  await expect(page.getByRole('heading',{name:'Bulan ke-1',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Pratinjau cetak / Unduh',exact:true}).click();
  await expect(page.getByLabel('Jenis laporan',{exact:true})).toHaveValue('MONTHLY');
  await expect(page.getByLabel('Nomor periode (kosong: saat ini)',{exact:true})).toHaveValue('1');
});
