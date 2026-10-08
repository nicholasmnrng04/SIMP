import { test, expect } from '@playwright/test';
import { projectInput } from '../support/project-fixture';

test('Beranda Team Leader mengikuti proyek terpilih dan tetap dapat dicari setelah dimuat ulang', async ({ page }, info) => {
  await page.goto('/masuk');
  await page.getByLabel('Email', { exact: true }).fill('team_leader@example.test');
  await page.getByLabel('Kata sandi', { exact: true }).fill(process.env.SIMP_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pemantauan proyek' })).toBeVisible();

  const me = await (await page.request.get('/api/auth/me')).json();
  const created = await page.request.post('/api/projects', {
    headers: { origin: 'http://127.0.0.1:5174' },
    data: projectInput({
      projectCode: `DASH-${info.project.name}-${Date.now()}`,
      projectName: 'Proyek Pilihan Dashboard',
      teamLeaderId: me.user.id,
    }),
  });
  expect(created.status()).toBe(201);
  const project = (await created.json()).project;

  await page.reload();
  const picker = page.getByRole('combobox', { name: 'Proyek yang dipantau' });
  await picker.selectOption(project.id);
  await expect(page).toHaveURL(new RegExp(`project=${project.id}`));
  await expect(page.getByRole('heading', { name: 'Proyek Pilihan Dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dokumentasi terbaru' })).toBeVisible();
  await expect(page.getByText('Belum ada foto laporan yang dapat ditampilkan.')).toBeVisible();

  const dashboard = await (await page.request.get('/api/dashboard')).json();
  const summary = dashboard.projectSummaries.find((item: { projectId: string }) => item.projectId === project.id);
  expect(summary).toBeDefined();
  await expect(page.locator('.dashboard-kpis')).toContainText(String(summary.pendingReviews));

  await page.reload();
  await expect(picker).toHaveValue(project.id);
  await page.getByRole('searchbox', { name: 'Cari proyek' }).fill(project.projectCode);
  await expect(page.locator('.dashboard-portfolio tbody tr')).toHaveCount(1);
  await expect(page.locator('.dashboard-portfolio tbody')).toContainText(project.projectCode);
  await page.getByRole('searchbox', { name: 'Cari proyek' }).fill('proyek yang tidak ada');
  await expect(page.getByText('Tidak ada proyek yang cocok. Coba nama atau kode lain.')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.goto(`/proyek/${project.id}#masalah-lapangan`);
  await expect(page.locator('#masalah-lapangan')).toBeInViewport();
  if (info.project.name === 'desktop') {
    await page.goto(`/ringkasan?project=${project.id}`);
    await expect(page.getByRole('heading', { name: 'Pemantauan proyek' })).toBeVisible();
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await page.screenshot({ path: info.outputPath('beranda-zoom-200.png'), fullPage: true });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
