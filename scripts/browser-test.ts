import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createTestDatabase } from '../tests/support/database.js';
import { migrate } from '../server/db/migrate.js';
import { bootstrapAdmin } from '../server/services/bootstrap-admin.js';
import { createUser } from '../server/services/users.js';
import { roleCodes, roleLabels } from '../shared/contracts.js';
import { createProject, saveProjectMember } from '../server/services/projects.js';
import { projectInput } from '../tests/support/project-fixture.js';
import { saveWorkItem } from '../server/services/work-items.js';
import { workItemDefaults } from '../shared/work-items.js';
import { planContext, publishPlan } from '../server/services/plans.js';
import { saveReport } from '../server/services/reports.js';
import { emptyReport } from '../shared/reports.js';
import { randomUUID } from 'node:crypto';
import { periods, newWeekConvention } from '../shared/plans.js';

const sandbox = await createTestDatabase();
const temporaryRoot = path.resolve('.tmp');
mkdirSync(temporaryRoot, { recursive: true });
const uploads = mkdtempSync(path.join(temporaryRoot, 'browser-uploads-'));

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function startService(arguments_: string[], environment: NodeJS.ProcessEnv) {
  return spawn(process.execPath, arguments_, {
    env: environment,
    stdio: 'ignore',
    windowsHide: true,
  });
}

async function waitForService(child: ChildProcess, url: string, label: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${label} pengujian gagal dijalankan.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Layanan masih melakukan inisialisasi.
    }
    await delay(200);
  }
  throw new Error(`${label} pengujian tidak siap dalam 30 detik.`);
}

async function stopService(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill();
  await Promise.race([exited, delay(3_000)]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await Promise.race([exited, delay(3_000)]);
  }
}

try {
  await migrate(sandbox.db);
  const password = randomBytes(24).toString('base64url');
  await bootstrapAdmin(sandbox.db, { name: 'Admin Pengujian', email: 'admin@example.test', password });
  const adminId = (await sandbox.db.query('SELECT id FROM users')).rows[0].id as string;
  for (const role of roleCodes.filter((value) => value !== 'ADMINISTRATOR')) {
    await createUser(sandbox.db, adminId, { name: roleLabels[role] + ' Pengujian', email: `${role.toLowerCase()}@example.test`, role, isActive: true, password });
  }
  const accounts = (await sandbox.db.query('SELECT id, role_code FROM users')).rows;
  const leaderId = accounts.find((user) => user.role_code === 'TEAM_LEADER')!.id as string;
  const project = await createProject(sandbox.db, leaderId, projectInput({ projectCode: 'BROWSER-SEED', projectName: 'Proyek Penugasan Uji', teamLeaderId: leaderId }));
  const workGroup = await saveWorkItem(sandbox.db, leaderId, project.id, null, { ...workItemDefaults, kind: 'GROUP', code: 'I', name: 'Kelompok Awal Uji' });
  await saveWorkItem(sandbox.db, leaderId, project.id, null, { ...workItemDefaults, code: 'A', name: 'Item Awal Uji', parentId: workGroup.id, unit: 'm³', contractVolume: '10', unitPrice: '100' });
  const plan = await planContext(sandbox.db, leaderId, project.id);
  const planPeriods = periods(project.startDate, project.endDate, 'WEEKLY', newWeekConvention);
  await publishPlan(sandbox.db, leaderId, project.id, { previousVersionId: null, basisToken: plan.basisToken, name: 'Rencana Awal', reason: 'Rencana pengujian browser', description: '', startDate: project.startDate, endDate: project.endDate, effectiveDate: project.startDate, granularity: 'WEEKLY', items: plan.basis.filter(item => item.kind === 'ITEM').map(item => ({ workItemId: item.id, targets: planPeriods.map((_, index) => index === 0 ? '50' : index === planPeriods.length - 1 ? '50' : '0') })) });
  for (const role of ['OWNER', 'ENGINEER', 'INSPECTOR']) {
    await saveProjectMember(sandbox.db, adminId, project.id, null, { userId: accounts.find((user) => user.role_code === role)!.id, role, startDate: project.today, endDate: null, isActive: true });
  }
  await saveReport(sandbox.db, accounts.find(user => user.role_code === 'INSPECTOR')!.id, project.id, null, { ...emptyReport(project.startDate), activities: [{ id: randomUUID(), workItemId: null, description: 'Catatan persiapan lapangan', location: '', quantity: null, notes: '' }] });
  await createProject(sandbox.db, adminId, projectInput({ projectCode: 'HIDDEN-SEED', projectName: 'Proyek Khusus Administrator' }));
  const serviceEnvironment = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: '3141',
    LOG_LEVEL: 'silent',
    APP_ORIGINS: 'http://127.0.0.1:5174',
    COOKIE_SECURE: 'false',
    DATABASE_SCHEMA: sandbox.schema,
    SIMP_TEST_UPLOAD_DIR: uploads,
    UPLOAD_DIR: uploads,
  };
  const useBuiltServer = process.env.SIMP_TEST_BUILT === 'true';
  let api: ChildProcess | undefined;
  let web: ChildProcess | undefined;
  try {
    api = startService(useBuiltServer ? ['dist/server/index.js'] : ['--import', 'tsx', 'server/index.ts'], serviceEnvironment);
    web = startService(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174'], serviceEnvironment);
    await Promise.all([
      waitForService(api, 'http://127.0.0.1:3141/api/health', 'Backend'),
      waitForService(web, 'http://127.0.0.1:5174', 'Frontend'),
    ]);
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
      env: {
        ...serviceEnvironment,
        SIMP_TEST_PASSWORD: password,
        SIMP_TEST_EXTERNAL_SERVERS: 'true',
      },
      stdio: 'inherit',
      windowsHide: true,
    });
    const [code] = await once(child, 'exit');
    process.exitCode = typeof code === 'number' ? code : 1;
  } finally {
    await Promise.all([stopService(web), stopService(api)]);
  }
} finally {
  try { await sandbox.close(); } finally {
    if (!path.resolve(uploads).startsWith(temporaryRoot + path.sep)) throw new Error('Lokasi folder foto tes tidak valid.');
    rmSync(uploads, { recursive: true, force: true });
  }
}
