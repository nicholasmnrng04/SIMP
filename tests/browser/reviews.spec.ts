import { test,expect,type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { projectInput } from '../support/project-fixture';
import { workItemDefaults } from '../../shared/work-items';
import { emptyReport } from '../../shared/reports';
import { roleLabels, type RoleCode } from '../../shared/contracts';
import { confirmAction } from './ui-navigation';

const headers={origin:'http://127.0.0.1:5174'};
async function login(page:Page,role:string) {
  await page.request.post('/api/auth/logout',{headers});await page.goto('/masuk');
  await page.getByLabel('Email',{exact:true}).fill(`${role}@example.test`);await page.getByLabel('Kata sandi',{exact:true}).fill(process.env.SIMP_TEST_PASSWORD!);
  await page.getByRole('button',{name:'Masuk',exact:true}).click();await expect(page.getByRole('heading',{name:'Proyek Anda',exact:true})).toBeVisible();
}
test('T06 pemeriksaan Engineer, perbaikan TL, koreksi dan histori Owner melalui desktop dan HP',async({page},info)=>{
  test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await login(page,'team_leader');const me=await(await page.request.get('/api/auth/me')).json();
  const created=await page.request.post('/api/projects',{headers,data:projectInput({projectCode:`REVIEW-${info.project.name}-${Date.now()}`,teamLeaderId:me.user.id})});expect(created.status()).toBe(201);const project=(await created.json()).project;
  await login(page,'admin');const candidates=(await(await page.request.get(`/api/projects/${project.id}/candidates`)).json()).users;
  for(const role of ['ENGINEER','INSPECTOR','OWNER']) {
    const user=candidates.find((u:{role:string;name:string})=>u.role===role&&u.name===`${roleLabels[role as RoleCode]} Pengujian`);
    expect((await page.request.post(`/api/projects/${project.id}/team`,{headers,data:{userId:user.id,role,startDate:project.today,endDate:null,isActive:true}})).status()).toBe(201);
  }
  const itemResponse=await page.request.post(`/api/projects/${project.id}/work-items`,{headers,data:{...workItemDefaults,code:'A',name:'Galian pemeriksaan',unit:'m',contractVolume:'1000',unitPrice:'100'}});expect(itemResponse.status()).toBe(201);const item=(await itemResponse.json()).item;
  await login(page,'team_leader');const plan=await(await page.request.get(`/api/projects/${project.id}/plans`)).json();expect((await page.request.post(`/api/projects/${project.id}/plans`,{headers,data:{previousVersionId:null,basisToken:plan.basisToken,name:'Rencana Awal',reason:'Rencana uji pemeriksaan',description:'',startDate:project.startDate,endDate:project.endDate,effectiveDate:project.startDate,granularity:'WEEKLY',items:[{workItemId:item.id,targets:['50','50']}]}})).status()).toBe(201);
  await login(page,'inspector');const activityId=randomUUID(),root=`/api/projects/${project.id}/reports`;
  const made=await page.request.post(root,{headers,data:{...emptyReport(project.startDate),activities:[{id:activityId,workItemId:item.id,description:'Pengukuran galian',location:'Utara',quantity:'75',notes:''}]}});expect(made.status()).toBe(201);const id=(await made.json()).id,route=`/proyek/${project.id}/laporan/${id}`;
  const png=await sharp({create:{width:320,height:180,channels:3,background:'#397860'}}).png().toBuffer();
  expect((await page.request.post(`${root}/${id}/photos`,{headers,data:{editVersion:1,activityId,caption:'Dokumentasi pengukuran',location:'Utara',takenDate:project.startDate,mime:'image/png',data:png.toString('base64')}})).status()).toBe(201);
  await page.goto(route);await page.getByRole('button',{name:'Periksa Sebelum Kirim',exact:true}).click();await page.getByRole('button',{name:'Kirim untuk Diperiksa',exact:true}).click();await expect(page.getByRole('button',{name:'Ubah Laporan',exact:true})).toHaveCount(0);
  await login(page,'engineer');await page.goto(`/proyek/${project.id}/laporan`);await page.getByRole('button',{name:'Menunggu pemeriksaan',exact:true}).click();await page.getByRole('link',{name:'Buka Laporan',exact:true}).click();
  await expect(page.getByRole('button',{name:'Setujui Laporan',exact:true})).toHaveCount(0);await page.getByLabel('Catatan pemeriksaan teknis',{exact:true}).fill('Ukur ulang bagian utara');await page.getByRole('button',{name:'Simpan Catatan Engineer',exact:true}).click();await expect(page.getByText('Catatan pemeriksaan tersimpan.',{exact:true})).toBeVisible();
  await login(page,'team_leader');await page.goto(route);await expect(page.getByText('Ukur ulang bagian utara',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Minta Perbaikan',exact:true}).click();await expect(page.getByRole('alert')).toContainText('minimal tiga');await page.getByLabel('Catatan keputusan (wajib untuk perbaikan)',{exact:true}).fill('Sesuaikan hasil ukur');await page.getByRole('button',{name:'Minta Perbaikan',exact:true}).click();await expect(page.getByText('Permintaan perbaikan tersimpan.',{exact:true})).toBeVisible();
  await login(page,'inspector');await page.goto(route);await page.getByRole('button',{name:'Ubah Laporan',exact:true}).click();await page.getByLabel('Volume kegiatan 1',{exact:true}).fill('70');await page.getByRole('button',{name:'Simpan Sementara',exact:true}).click();await page.getByRole('button',{name:'Periksa Sebelum Kirim',exact:true}).click();await page.getByRole('button',{name:'Kirim untuk Diperiksa',exact:true}).click();await expect(page.getByRole('button',{name:'Ubah Laporan',exact:true})).toHaveCount(0);
  await login(page,'team_leader');await page.goto(route);await page.getByRole('button',{name:'Setujui Laporan',exact:true}).click();await confirmAction(page,'Setujui laporan');await expect(page.getByText('Laporan berhasil disetujui.',{exact:true})).toBeVisible();
  await login(page,'inspector');await page.goto(route);await page.getByText('Koreksi laporan disetujui',{exact:true}).first().click();await page.getByRole('button',{name:'Buat Koreksi',exact:true}).click();await expect(page.getByRole('alert')).toContainText('minimal tiga');await page.getByLabel('Alasan koreksi',{exact:true}).fill('Hasil ukur akhir menjadi 60');await page.getByRole('button',{name:'Buat Koreksi',exact:true}).click();await expect(page).not.toHaveURL(route);await expect(page.getByRole('button',{name:'Ubah Laporan',exact:true})).toBeVisible();const correctionRoute=page.url(),correctionId=correctionRoute.split('/').at(-1)!;
  await login(page,'owner');await page.goto(route);await expect(page.getByRole('link',{name:'Versi 2',exact:true})).toHaveCount(0);expect((await page.request.get(`${root}/${correctionId}`)).status()).toBe(404);await expect(page.getByRole('button',{name:'Buat Koreksi',exact:true})).toHaveCount(0);
  await login(page,'inspector');await page.goto(correctionRoute);await page.getByRole('button',{name:'Ubah Laporan',exact:true}).click();await page.getByLabel('Volume kegiatan 1',{exact:true}).fill('60');await page.getByRole('button',{name:'Simpan Sementara',exact:true}).click();await page.getByRole('button',{name:'Periksa Sebelum Kirim',exact:true}).click();await page.getByRole('button',{name:'Kirim untuk Diperiksa',exact:true}).click();await expect(page.getByRole('button',{name:'Ubah Laporan',exact:true})).toHaveCount(0);
  await login(page,'team_leader');await page.goto(correctionRoute);await page.getByRole('button',{name:'Setujui Laporan',exact:true}).click();await confirmAction(page,'Setujui laporan');await expect(page.getByText('Laporan berhasil disetujui.',{exact:true})).toBeVisible();
  await login(page,'owner');await page.goto(correctionRoute);await expect(page.getByText('Versi 2 · Digunakan dalam perhitungan kemajuan',{exact:true})).toBeVisible();const image=page.getByRole('img',{name:'Dokumentasi pengukuran',exact:true});await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('koreksi-disetujui.png'),fullPage:true});
  await page.getByText('Riwayat pemeriksaan dan versi',{exact:true}).click();await page.getByRole('link',{name:'Versi 1',exact:true}).click();await expect(page.getByText('Versi 1 · Arsip versi disetujui, telah digantikan',{exact:true})).toBeVisible();const archivedActivity=page.getByRole('row').filter({hasText:'Pengukuran galian'});await expect(archivedActivity).toContainText('70,000000 m');await expect(archivedActivity).toContainText('Utara');await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);expect(errors).toEqual([]);
});
