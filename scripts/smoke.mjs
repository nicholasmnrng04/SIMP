import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { emptyReport } from '../dist/shared/reports.js';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createTestDatabase } from '../dist/tests/support/database.js';
import { projectInput } from '../dist/tests/support/project-fixture.js';
import { workItemDefaults } from '../dist/shared/work-items.js';

const tempRoot = path.resolve('.tmp');
mkdirSync(tempRoot, { recursive: true });
const temp = mkdtempSync(path.join(tempRoot, 'simp-smoke-'));
const sandbox = await createTestDatabase();
const env = { ...process.env, DATABASE_SCHEMA: sandbox.schema, UPLOAD_DIR: path.join(temp, 'uploads'), LOG_LEVEL: 'silent', HOST: '127.0.0.1' };
for (const key of Object.keys(env)) if (key.startsWith('BOOTSTRAP_ADMIN_')) delete env[key];
const password = randomBytes(24).toString('hex');
let sessionCookie;
let projectId;
let workId;
let leaderId, leaderCookie, planId;
let reportId, photoId;

async function run(args, variables = env) {
  const child = spawn(process.execPath, args, { env: variables, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (data) => { output += data; });
  child.stderr.on('data', (data) => { output += data; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, output);
}

async function unusedPort() {
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startAndCheck(args, extraChecks = false) {
  const port = await unusedPort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, args, { env: { ...env, PORT: String(port), APP_ORIGINS: url, COOKIE_SECURE: 'false' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (data) => { output += data; });
  child.stderr.on('data', (data) => { output += data; });
  const exited = once(child, 'exit');
  try {
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (child.exitCode !== null) throw new Error(output || 'Server berhenti terlalu awal.');
      try {
        const health = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(500) });
        if (health.ok && (await health.json()).status === 'ok') { ready = true; break; }
      } catch { /* Server belum siap. */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, `Server tidak siap: ${output}`);
    if (!sessionCookie) {
      const signedIn = await fetch(`${url}/api/auth/login`, { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'smoke@example.test', password }) });
      assert.equal(signedIn.status, 200);
      sessionCookie = signedIn.headers.get('set-cookie').split(';')[0];
    }
    const identity = await fetch(`${url}/api/auth/me`, { headers: { Cookie: sessionCookie } });
    assert.equal(identity.status, 200);
    assert.equal((await identity.json()).user.role, 'ADMINISTRATOR');
    if (!leaderId) {
      const created = await fetch(`${url}/api/users`, { method: 'POST', headers: { Cookie: sessionCookie, Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'TL Persistensi', email: 'leader-smoke@example.test', password, role: 'TEAM_LEADER', isActive: true }) });
      assert.equal(created.status, 201); leaderId = (await created.json()).user.id;
      const login = await fetch(`${url}/api/auth/login`, { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'leader-smoke@example.test', password }) });
      assert.equal(login.status, 200); leaderCookie = login.headers.get('set-cookie').split(';')[0];
    }
    if (!projectId) {
      const created = await fetch(`${url}/api/projects`, { method: 'POST', headers: { Cookie: sessionCookie, Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify(projectInput({ teamLeaderId: leaderId })) });
      assert.equal(created.status, 201);
      projectId = (await created.json()).project.id;
    }
    const project = await fetch(`${url}/api/projects/${projectId}`, { headers: { Cookie: sessionCookie } });
    assert.equal(project.status, 200);
    const saved = (await project.json()).project;
    assert.equal(saved.projectName, 'Jalan Uji');
    assert.equal(saved.durationDays, 8);
    assert.equal(saved.initialContractValue, '1000000.25');
    if (!workId) {
      const createdWork = await fetch(`${url}/api/projects/${projectId}/work-items`, { method: 'POST', headers: { Cookie: sessionCookie, Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...workItemDefaults, code: 'A', name: 'Pekerjaan persistensi', unit: 'm³', contractVolume: '10', unitPrice: '100' }) });
      assert.equal(createdWork.status, 201); workId = (await createdWork.json()).item.id;
    }
    const work = await fetch(`${url}/api/projects/${projectId}/work-items`, { headers: { Cookie: sessionCookie } });
    assert.equal(work.status, 200);
    const calculation = await work.json();
    assert.equal(calculation.totalAmount, '1000.00000000');
    assert.equal(calculation.items[0].id, workId);
    assert.equal(calculation.items[0].weight, '100.000000');
    if (!planId) {
      const contextResponse = await fetch(`${url}/api/projects/${projectId}/plans`, { headers: { Cookie: leaderCookie } });
      assert.equal(contextResponse.status, 200); const context = await contextResponse.json();
      const created = await fetch(`${url}/api/projects/${projectId}/plans`, { method: 'POST', headers: { Cookie: leaderCookie, Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ previousVersionId: null, basisToken: context.basisToken, name: 'Rencana Awal', reason: 'Uji persistensi rencana', description: '', startDate: saved.startDate, endDate: saved.endDate, effectiveDate: saved.startDate, granularity: 'WEEKLY', items: [{ workItemId: workId, targets: ['50','50'] }] }) });
      assert.equal(created.status, 201); planId = (await created.json()).id;
    }
    const plans = await fetch(`${url}/api/projects/${projectId}/plans`, { headers: { Cookie: leaderCookie } });
    assert.equal(plans.status, 200); const history = await plans.json();
    assert.equal(history.versions.length, 1); assert.equal(history.versions[0].id, planId); assert.equal(history.versions[0].isBaseline, true);
    const series = await fetch(`${url}/api/projects/${projectId}/plans/${planId}/series?type=WEEKLY`, { headers: { Cookie: sessionCookie } });
    assert.equal(series.status, 200); assert.deepEqual((await series.json()).periods.map(period => period.cumulative), ['50.000000','100.000000']);
    if (!reportId) {
      const created = await fetch(`${url}/api/projects/${projectId}/reports`, { method: 'POST', headers: { Cookie: leaderCookie, Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...emptyReport(saved.startDate), activities: [{ id: randomUUID(), workItemId: workId, description: 'Kegiatan untuk uji restart', location: 'Lokasi tes', quantity: '1', notes: '' }] }) });
      assert.equal(created.status, 201); reportId = (await created.json()).id;
      const detail = await (await fetch(`${url}/api/projects/${projectId}/reports/${reportId}`, { headers: { Cookie: leaderCookie } })).json();
      const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#397860' } }).png().toBuffer();
      const uploaded = await fetch(`${url}/api/projects/${projectId}/reports/${reportId}/photos`, { method: 'POST', headers: { Cookie: leaderCookie, Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ editVersion: 1, activityId: detail.activities[0].id, caption: 'Foto persistensi', location: 'Lokasi tes', takenDate: saved.startDate, mime: 'image/png', data: png.toString('base64') }) });
      assert.equal(uploaded.status, 201); photoId = (await uploaded.json()).id;
      const submitted = await fetch(`${url}/api/projects/${projectId}/reports/${reportId}/submit`, { method: 'POST', headers: { Cookie: leaderCookie, Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ editVersion: 2 }) });
      assert.equal(submitted.status, 204);
      const approved = await fetch(`${url}/api/projects/${projectId}/reports/${reportId}/reviews`, { method: 'POST', headers: { Cookie: leaderCookie, Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ editVersion: 3, kind: 'APPROVE', note: 'Disetujui untuk uji persistensi' }) });
      assert.equal(approved.status, 204);
    }
    const report = await fetch(`${url}/api/projects/${projectId}/reports/${reportId}`, { headers: { Cookie: leaderCookie } });
    assert.equal(report.status, 200); const detail = await report.json();
    assert.equal(detail.status, 'APPROVED'); assert.equal(detail.isAuthoritative, true); assert.equal(detail.reviews.length, 1); assert.equal(detail.activities[0].quantity, '1.000000'); assert.equal(detail.photos[0].id, photoId);
      const progressResponse = await fetch(`${url}/api/projects/${projectId}/progress`, { headers: { Cookie: leaderCookie } });
      assert.equal(progressResponse.status, 200);
      const progress = await progressResponse.json();
      assert.equal(progress.total.actual.cumulative, '10.000000'); assert.equal(progress.sourceCount, 1);
      const periodicResponse = await fetch(`${url}/api/projects/${projectId}/period-reports?type=MONTHLY&period=1`, { headers: { Cookie: leaderCookie } });
      assert.equal(periodicResponse.status, 200);
      const periodic = await periodicResponse.json();
      assert.equal(periodic.progress.total.actual.cumulative, '10.000000'); assert.equal(periodic.reports.length, 1);
        for (const format of ['pdf','xlsx']) {
          const exported = await fetch(`${url}/api/projects/${projectId}/exports?kind=PROGRESS&format=${format}`, {headers:{Cookie:leaderCookie}});
          assert.equal(exported.status,200);
          const bytes=Buffer.from(await exported.arrayBuffer());
          assert.equal(bytes.subarray(0,format==='pdf'?5:2).toString(),format==='pdf'?'%PDF-':'PK');
        }
      const monitoringResponse = await fetch(`${url}/api/projects/${projectId}/monitoring`, { headers: { Cookie: leaderCookie } });
      assert.equal(monitoringResponse.status, 200);
      const monitoring = await monitoringResponse.json();
      assert.equal(monitoring.progress.total.actual.cumulative, '10.000000');
      assert.equal(monitoring.curve.points.filter(p => p.actual !== null).at(-1).actual, '10.000000');
      const galleryResponse = await fetch(`${url}/api/projects/${projectId}/gallery`, { headers: { Cookie: leaderCookie } });
      assert.equal(galleryResponse.status, 200); assert.equal((await galleryResponse.json()).photos.length, 1);
      const photo = await fetch(`${url}${detail.photos[0].url}`, { headers: { Cookie: leaderCookie } });
    assert.equal(photo.status, 200); assert.equal((await sharp(Buffer.from(await photo.arrayBuffer())).metadata()).format, 'jpeg');
    assert.equal((await fetch(`${url}${detail.photos[0].url}`)).status, 401);
    if (extraChecks) {
      const html = await (await fetch(url)).text();
      assert.match(html, /lang="id"/);
      const asset = html.match(/src="([^"]+\.js)"/)[1];
      assert.equal((await fetch(`${url}${asset}`)).status, 200);
      assert.match(await (await fetch(`${url}/masuk`)).text(), /lang="id"/);
      assert.match(await (await fetch(`${url}/pengguna`)).text(), /lang="id"/);
      assert.equal((await fetch(`${url}/api/missing`)).status, 404);
      assert.equal((await fetch(`${url}/.env`)).status, 404);
      assert.equal((await fetch(`${url}/storage/uploads/missing.jpg`)).status, 404);
    }
  } finally {
    if (child.exitCode === null) child.kill();
    await exited;
  }
}

try {
  await run(['dist/server/cli/migrate.js']);
  await run(['dist/server/cli/bootstrap.js'], {
    ...env, BOOTSTRAP_ADMIN_NAME: 'Administrator Pengujian',
    BOOTSTRAP_ADMIN_EMAIL: 'smoke@example.test', BOOTSTRAP_ADMIN_PASSWORD: password,
  });
  if (process.env.SIMP_SMOKE_BUILT_ONLY !== 'true') {
    await startAndCheck(['--import', 'tsx', 'server/index.ts']);
  }
  await startAndCheck(['dist/server/index.js'], true);
  await startAndCheck(['dist/server/index.js'], true);
  assert.equal((await sandbox.db.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count, 2);
  assert.equal((await sandbox.db.query('SELECT COUNT(*)::int AS count FROM projects')).rows[0].count, 1);
  assert.equal((await sandbox.db.query('SELECT COUNT(*)::int AS count FROM work_items')).rows[0].count, 1);
  assert.equal((await sandbox.db.query('SELECT COUNT(*)::int AS count FROM project_plan_versions')).rows[0].count, 1);
  assert.equal((await sandbox.db.query('SELECT COUNT(*)::int AS count FROM daily_reports')).rows[0].count, 1);
  assert.equal((await sandbox.db.query('SELECT COUNT(*)::int AS count FROM daily_report_photos')).rows[0].count, 1);
  assert.equal((await sandbox.db.query('SELECT COUNT(*)::int AS count FROM approved_report_sources')).rows[0].count, 1);
  assert.equal((await sandbox.db.query('SELECT COUNT(*)::int AS count FROM audit_events')).rows[0].count, 10);
  const serverCoverage = process.env.SIMP_SMOKE_BUILT_ONLY === 'true' ? 'server build' : 'server development/build';
  console.log(`LULUS: migration, bootstrap CLI, ${serverCoverage}, restart, persistensi akun/sesi/proyek/pekerjaan/bobot/rencana/target/laporan/foto, routing UI dan akses berkas privat.`);
} finally {
  await sandbox.close();
  if (!path.resolve(temp).startsWith(tempRoot + path.sep)) throw new Error('Lokasi pembersihan tidak valid.');
  rmSync(temp, { recursive: true, force: true });
}
