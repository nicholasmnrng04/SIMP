import type { Page } from '@playwright/test';

export async function projectSection(page:Page, path:string) {
  const root='/proyek/'+new URL(page.url()).pathname.split('/')[2];
  const labels:Record<string,string>={pekerjaan:'Daftar Pekerjaan',rencana:'Jadwal & Target',laporan:'Laporan Harian','laporan-berkala':'Rekap & Unduhan',tim:'Tim',informasi:'Informasi Proyek',dokumentasi:'Dokumentasi'};
  if(labels[path]) {
    if((page.viewportSize()?.width??1280)<=720) await page.getByRole('button',{name:'Buka navigasi',exact:true}).click();
    await page.getByRole('navigation',{name:'Bagian proyek',exact:true}).getByRole('link',{name:labels[path],exact:true}).click();
  } else await page.goto(`${root}/${path}`);
}

export async function confirmAction(page: Page, buttonName: string) {
  await page.getByRole('dialog').getByRole('button', { name: buttonName, exact: true }).click();
}
