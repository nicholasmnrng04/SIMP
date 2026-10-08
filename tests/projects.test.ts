import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { buildApp } from '../server/app.js';
import { migrate } from '../server/db/migrate.js';
import { bootstrapAdmin } from '../server/services/bootstrap-admin.js';
import { createUser, updateUser } from '../server/services/users.js';
import * as service from '../server/services/projects.js';
import { automaticProjectStatus, projectSchema, dateSchema, type MemberInput, type Project } from '../shared/projects.js';
import { openDatabase } from '../server/db/database.js';
import { readConfig } from '../server/config.js';
import { createTestDatabase } from './support/database.js';
import { projectInput } from './support/project-fixture.js';

const password = 'KataSandiProyekUji-2026', origin = 'http://127.0.0.1:5173';
async function setup(t: TestContext) {
  const sandbox = await createTestDatabase(); t.after(sandbox.close); await migrate(sandbox.db);
  await bootstrapAdmin(sandbox.db, { name: 'Admin', email: 'admin@example.test', password });
  const adminId = (await sandbox.db.query('SELECT id FROM users')).rows[0].id as string;
  const accounts: Record<string, { id: string; email: string; name: string }> = { ADMINISTRATOR: { id: adminId, email: 'admin@example.test', name: 'Admin' } };
  for (const role of ['TEAM_LEADER', 'OWNER', 'ENGINEER', 'INSPECTOR']) accounts[role] = await createUser(sandbox.db, adminId, { name: role, email: `${role.toLowerCase()}@example.test`, password, role, isActive: true });
  accounts.OTHER_TL = await createUser(sandbox.db, adminId, { name: 'TL Lain', email: 'other@example.test', password, role: 'TEAM_LEADER', isActive: true });
  const app = buildApp({ db: sandbox.db }); t.after(() => app.close());
  const cookies: Record<string, string> = {};
  async function login(role: string) {
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { email: accounts[role].email, password } });
    assert.equal(response.statusCode, 200); return String(response.headers['set-cookie']).split(';')[0];
  }
  async function request(role: string | null, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: Record<string, unknown>) {
    if (role && !cookies[role]) cookies[role] = await login(role);
    return app.inject({ method, url, headers: { origin, ...(role ? { cookie: cookies[role] } : {}) }, ...(payload !== undefined ? { payload } : {}) });
  }
  async function create(code = 'PRJ-001', leader = accounts.TEAM_LEADER.id) {
    return service.createProject(sandbox.db, adminId, projectInput({ projectCode: code, teamLeaderId: leader }));
  }
  const member = (role: string, patch: Partial<MemberInput> = {}): MemberInput => ({ userId: accounts[role].id, role: role as MemberInput['role'], startDate: '2020-01-01', endDate: null, isActive: true, ...patch });
  return { ...sandbox, app, accounts, adminId, request, create, member };
}

test('validasi proyek menolak tanggal palsu, urutan dan uang tidak sah; status memakai batas inklusif', () => {
  for (const value of ['2026-02-29', '2026-99-12', '2026-04-31', '', '2026-1-01']) assert.equal(dateSchema.safeParse(value).success, false);
  assert.equal(dateSchema.safeParse('2024-02-29').success, true);
  for (const patch of [{ projectName: '' }, { endDate: '2026-07-15' }, { initialContractValue: '-1' }, { currentContractValue: '1.001' }, { initialContractValue: '90071992547409.92' }]) assert.equal(projectSchema.safeParse(projectInput(patch)).success, false);
  assert.equal(projectSchema.safeParse(projectInput({ initialContractValue: '90071992547409.91' })).success, true);
  assert.equal(automaticProjectStatus('2026-07-15', '2026-07-16', '2026-07-23'), 'NOT_STARTED');
  for (const today of ['2026-07-16', '2026-07-23']) assert.equal(automaticProjectStatus(today, '2026-07-16', '2026-07-23'), 'IN_PROGRESS');
  assert.equal(automaticProjectStatus('2026-07-24', '2026-07-16', '2026-07-23'), 'DELAYED');
});

test('CRUD proyek melalui API, nilai sen presisi, pencarian dan persistensi koneksi baru', async (t) => {
  const { db, schema, accounts, request } = await setup(t);
  const input = projectInput({ teamLeaderId: accounts.TEAM_LEADER.id, initialContractValue: '90071992547409.91' });
  assert.equal((await request(null, 'GET', '/api/projects')).statusCode, 401);
  for (const patch of [{ endDate: '2026-07-01' }, { initialContractValue: '-1' }, { contractDate: '2026-99-12' }, { projectName: '' }]) assert.equal((await request('ADMINISTRATOR', 'POST', '/api/projects', { ...input, ...patch })).statusCode, 400);
  const created = await request('ADMINISTRATOR', 'POST', '/api/projects', input);
  assert.equal(created.statusCode, 201, created.body); const project = created.json().project as Project;
  assert.equal(project.durationDays, 8); assert.equal(project.initialContractValue, '90071992547409.91');
  assert.equal(project.clientAgencyAddress, input.clientAgencyAddress);
  assert.equal(project.contractorName, 'Kontraktor Uji');
  assert.equal((await request('ADMINISTRATOR', 'POST', '/api/projects', { ...input, contractorName: 'x'.repeat(251) })).statusCode, 400);
  const signed = await request('ADMINISTRATOR', 'GET', `/api/projects/${project.id}`);
  assert.equal(signed.headers['cache-control'], 'no-store');
  assert.equal((await request('ADMINISTRATOR', 'POST', '/api/projects', input)).statusCode, 409);
  const edited = await request('TEAM_LEADER', 'PATCH', `/api/projects/${project.id}`, { ...input, projectName: 'Jalan Diperbarui', currentContractValue: '0.01', contractorName: ' PT Kontraktor Baru ' });
  assert.equal(edited.json().project.contractorName, 'PT Kontraktor Baru');
  const { contractorName: omitted, ...oldClient } = { ...input, projectName: 'Jalan Diperbarui', currentContractValue: '0.01' };
  assert.equal((await request('TEAM_LEADER', 'PATCH', `/api/projects/${project.id}`, oldClient)).json().project.contractorName, 'PT Kontraktor Baru');
  assert.equal(edited.statusCode, 200, edited.body); assert.equal(edited.json().project.currentContractValue, '0.01');
  for (const q of ['diperbarui', 'PRJ-001', 'KONTRAK/001', 'bandung']) assert.equal((await request('TEAM_LEADER', 'GET', `/api/projects?q=${encodeURIComponent(q)}`)).json().projects.length, 1);
  assert.equal((await request('TEAM_LEADER', 'GET', '/api/projects?q=tidak-ada')).json().projects.length, 0);
  const reopened = openDatabase(readConfig().databaseUrl, schema);
  try { const stored = await service.getProject(reopened, accounts.TEAM_LEADER.id, project.id); assert.equal(stored.projectName, 'Jalan Diperbarui'); assert.equal(stored.initialContractValue, '90071992547409.91'); }
  finally { await reopened.end(); }
  assert.equal((await request('TEAM_LEADER', 'GET', `/api/projects/${project.id}`)).json().project.contractorName, 'PT Kontraktor Baru');
  assert.equal((await db.query('SELECT initial_contract_value_cents FROM projects WHERE id = $1', [project.id])).rows[0].initial_contract_value_cents, '9007199254740991');
});

test('isolasi proyek A/B berlaku untuk semua endpoint dan Owner/Engineer/Inspector hanya membaca', async (t) => {
  const { accounts, adminId, db, request, create, member } = await setup(t);
  const a = await create('A'), b = await create('B', accounts.OTHER_TL.id);
  for (const role of ['OWNER', 'ENGINEER', 'INSPECTOR']) await service.saveProjectMember(db, adminId, a.id, null, member(role));
  for (const role of ['TEAM_LEADER', 'OWNER', 'ENGINEER', 'INSPECTOR']) {
    assert.deepEqual((await request(role, 'GET', '/api/projects')).json().projects.map((p: Project) => p.id), [a.id]);
    assert.equal((await request(role, 'GET', `/api/projects/${a.id}`)).statusCode, 200);
    assert.equal((await request(role, 'GET', `/api/projects/${a.id}/team`)).statusCode, 200);
    for (const url of [`/api/projects/${b.id}`, `/api/projects/${b.id}/team`, `/api/projects/${b.id}/candidates`]) assert.equal((await request(role, 'GET', url)).statusCode, 404);
    assert.equal((await request(role, 'PATCH', `/api/projects/${b.id}`, projectInput({ teamLeaderId: accounts.OTHER_TL.id }))).statusCode, 404);
    assert.equal((await request(role, 'DELETE', `/api/projects/${b.id}`, { confirm: true, reason: 'Coba lintas proyek' })).statusCode, 404);
    if (role !== 'TEAM_LEADER') {
      assert.equal((await request(role, 'POST', '/api/projects', projectInput())).statusCode, 403);
      assert.equal((await request(role, 'PATCH', `/api/projects/${a.id}`, projectInput())).statusCode, 403);
      assert.equal((await request(role, 'PATCH', `/api/projects/${a.id}/status`, { statusOverride: 'CLOSED', reason: 'Coba ubah' })).statusCode, 403);
      assert.equal((await request(role, 'POST', `/api/projects/${a.id}/team`, member('INSPECTOR'))).statusCode, 403);
      assert.equal((await request(role, 'GET', `/api/projects/${a.id}/candidates`)).statusCode, 403);
      assert.equal((await request(role, 'DELETE', `/api/projects/${a.id}`, { confirm: true, reason: 'Coba arsip' })).statusCode, 403);
    }
  }
  assert.equal((await request('ADMINISTRATOR', 'GET', '/api/projects')).json().projects.length, 2);
  const directory = (await request('OWNER', 'GET', `/api/projects/${a.id}/team`)).json().members;
  assert.equal(directory.some((m: { userId: string }) => m.userId === accounts.OTHER_TL.id), false);
  assert.equal(JSON.stringify(directory).includes('password'), false);
  assert.equal((await request('OWNER', 'GET', '/api/users')).statusCode, 403);
});

test('TL pembuat mendapat akses persiapan proyek; pergantian TL hanya Admin dan akses lama dicabut', async (t) => {
  const { db, adminId, accounts, request } = await setup(t);
  const data = projectInput({ teamLeaderId: accounts.TEAM_LEADER.id, startDate: '2099-01-01', endDate: '2099-01-08' });
  const created = await request('TEAM_LEADER', 'POST', '/api/projects', data);
  assert.equal(created.statusCode, 201); const project = created.json().project as Project;
  assert.equal(project.status, 'NOT_STARTED');
  const assigned = await service.projectTeam(db, adminId, project.id);
  assert.equal(assigned[0].startDate, project.today); assert.equal(assigned[0].effective, true);
  assert.equal((await request('TEAM_LEADER', 'GET', `/api/projects/${project.id}`)).statusCode, 200);
  assert.equal((await request('TEAM_LEADER', 'POST', '/api/projects', { ...data, teamLeaderId: accounts.OTHER_TL.id })).statusCode, 403);
  assert.equal((await request('TEAM_LEADER', 'PATCH', `/api/projects/${project.id}`, { ...data, teamLeaderId: accounts.OTHER_TL.id })).statusCode, 403);
  assert.equal((await request('ADMINISTRATOR', 'PATCH', `/api/projects/${project.id}`, { ...data, teamLeaderId: accounts.OTHER_TL.id })).statusCode, 200);
  assert.equal((await request('TEAM_LEADER', 'GET', `/api/projects/${project.id}`)).statusCode, 404);
  assert.equal((await request('OTHER_TL', 'GET', `/api/projects/${project.id}`)).statusCode, 200);
  const history = await service.projectTeam(db, adminId, project.id);
  assert.equal(history.length, 2); assert.equal(history.find((m) => m.userId === accounts.TEAM_LEADER.id)?.isActive, false);
  const leadAssignment = history.find((m) => m.userId === accounts.OTHER_TL.id)!;
  await service.saveProjectMember(db, adminId, project.id, leadAssignment.id, { userId: accounts.OTHER_TL.id, role: 'TEAM_LEADER', startDate: '2020-01-01', endDate: '2020-01-02', isActive: true });
  assert.equal((await request('OTHER_TL', 'GET', `/api/projects/${project.id}`)).statusCode, 404);
  await service.saveProjectMember(db, adminId, project.id, leadAssignment.id, { userId: accounts.OTHER_TL.id, role: 'TEAM_LEADER', startDate: project.today, endDate: project.today, isActive: true });
  assert.equal((await request('OTHER_TL', 'GET', `/api/projects/${project.id}`)).statusCode, 200);
  await assert.rejects(service.saveProjectMember(db, adminId, project.id, history.find((m) => m.userId === accounts.TEAM_LEADER.id)!.id, { userId: accounts.TEAM_LEADER.id, role: 'TEAM_LEADER', startDate: project.today, endDate: null, isActive: true }), { statusCode: 400 });
});

test('periode penugasan inklusif, nonaktif langsung berlaku, satu pengguna beberapa proyek dan role akun berubah', async (t) => {
  const { db, adminId, accounts, request, create, member } = await setup(t);
  const a = await create('A'), b = await create('B');
  const original = await service.saveProjectMember(db, adminId, a.id, null, member('INSPECTOR', { startDate: '2099-01-01' }));
  assert.equal((await request('INSPECTOR', 'GET', `/api/projects/${a.id}`)).statusCode, 404);
  await service.saveProjectMember(db, adminId, a.id, original.id, member('INSPECTOR', { startDate: a.today, endDate: a.today }));
  assert.equal((await request('INSPECTOR', 'GET', `/api/projects/${a.id}`)).statusCode, 200);
  await service.saveProjectMember(db, adminId, b.id, null, member('INSPECTOR'));
  assert.equal((await request('INSPECTOR', 'GET', '/api/projects')).json().projects.length, 2);
  await service.saveProjectMember(db, adminId, a.id, original.id, member('INSPECTOR', { isActive: false }));
  assert.equal((await request('INSPECTOR', 'GET', `/api/projects/${a.id}`)).statusCode, 404);
  await service.saveProjectMember(db, adminId, a.id, original.id, member('INSPECTOR', { endDate: '2020-01-01' }));
  assert.equal((await request('INSPECTOR', 'GET', `/api/projects/${a.id}`)).statusCode, 404);
  await updateUser(db, adminId, accounts.INSPECTOR.id, { name: 'Role Berubah', email: accounts.INSPECTOR.email, role: 'ENGINEER', isActive: true });
  assert.deepEqual(await service.listProjects(db, accounts.INSPECTOR.id), []);
  await assert.rejects(service.getProject(db, accounts.INSPECTOR.id, b.id), { statusCode: 404 });
  assert.equal((await service.projectTeam(db, adminId, b.id)).find((m) => m.userId === accounts.INSPECTOR.id)?.effective, false);
});

test('mutasi tim memvalidasi role, anggota lintas proyek, konflik periode dan transaksi bersamaan', async (t) => {
  const { db, adminId, accounts, request, create, member } = await setup(t);
  const a = await create('A'), b = await create('B');
  const candidates = (await request('TEAM_LEADER', 'GET', `/api/projects/${a.id}/candidates`)).json().users as { role: string }[];
  assert.ok(candidates.every((u) => ['ENGINEER', 'INSPECTOR'].includes(u.role)));
  assert.equal((await request('TEAM_LEADER', 'POST', `/api/projects/${a.id}/team`, member('OWNER'))).statusCode, 403);
  assert.equal((await request('ADMINISTRATOR', 'POST', `/api/projects/${a.id}/team`, member('OWNER', { role: 'INSPECTOR' }))).statusCode, 400);
  const one = await service.saveProjectMember(db, adminId, a.id, null, member('ENGINEER', { endDate: '2020-02-01' }));
  assert.equal((await request('ADMINISTRATOR', 'PATCH', `/api/projects/${b.id}/team/${one.id}`, member('ENGINEER'))).statusCode, 404);
  assert.equal((await request('ADMINISTRATOR', 'PATCH', `/api/projects/${a.id}/team/${one.id}`, member('INSPECTOR'))).statusCode, 400);
  assert.equal((await request('ADMINISTRATOR', 'POST', `/api/projects/${a.id}/team`, member('ENGINEER', { startDate: '2020-02-01' }))).statusCode, 409);
  assert.equal((await request('ADMINISTRATOR', 'POST', `/api/projects/${a.id}/team`, member('ENGINEER', { startDate: '2020-02-02' }))).statusCode, 201);
  const attempts = await Promise.allSettled([0, 1].map(() => service.saveProjectMember(db, adminId, a.id, null, member('INSPECTOR'))));
  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
  await updateUser(db, adminId, accounts.OWNER.id, { name: accounts.OWNER.name, email: accounts.OWNER.email, role: 'OWNER', isActive: false });
  assert.equal((await request('ADMINISTRATOR', 'POST', `/api/projects/${a.id}/team`, member('OWNER'))).statusCode, 400);
});

test('status manual beralasan dan arsip mempertahankan relasi/histori serta menolak mutasi', async (t) => {
  const { db, adminId, request, create, member } = await setup(t);
  const project = await create(); await service.saveProjectMember(db, adminId, project.id, null, member('OWNER'));
  const url = `/api/projects/${project.id}`;
  assert.equal((await request('TEAM_LEADER', 'PATCH', `${url}/status`, { statusOverride: 'COMPLETED', reason: '' })).statusCode, 400);
  const response = await request('TEAM_LEADER', 'PATCH', `${url}/status`, { statusOverride: 'COMPLETED', reason: 'Pekerjaan dinyatakan selesai melalui pemeriksaan lapangan.' });
  assert.equal(response.statusCode, 200); assert.equal(response.json().project.status, 'COMPLETED');
  assert.equal((await request('OWNER', 'GET', '/api/projects?status=COMPLETED')).json().projects.length, 1);
  await service.changeProjectStatus(db, adminId, project.id, { statusOverride: null, reason: 'Kembali mengikuti jadwal' });
  assert.equal((await service.getProject(db, adminId, project.id)).status, project.automaticStatus);
  const before = (await db.query('SELECT COUNT(*)::int AS n FROM audit_events WHERE project_id = $1', [project.id])).rows[0].n;
  assert.equal((await request('TEAM_LEADER', 'DELETE', url, { confirm: false, reason: 'Simpan arsip' })).statusCode, 400);
  assert.equal((await request('TEAM_LEADER', 'DELETE', url, { confirm: true, reason: 'Simpan arsip' })).statusCode, 204);
  assert.equal((await request('ADMINISTRATOR', 'GET', '/api/projects')).json().projects.length, 0);
  assert.equal((await request('OWNER', 'GET', '/api/projects?archived=true')).json().projects.length, 1);
  assert.equal((await request('OWNER', 'GET', url)).json().project.canManage, false);
  assert.equal((await request('ADMINISTRATOR', 'PATCH', url, projectInput())).statusCode, 409);
  assert.equal((await request('TEAM_LEADER', 'POST', `${url}/team`, member('INSPECTOR'))).statusCode, 409);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM project_members WHERE project_id = $1', [project.id])).rows[0].n, 2);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM audit_events WHERE project_id = $1', [project.id])).rows[0].n, before + 1);
});
