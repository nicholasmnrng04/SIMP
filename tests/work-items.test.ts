import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { buildApp } from '../server/app.js';
import { migrate } from '../server/db/migrate.js';
import { openDatabase, transaction } from '../server/db/database.js';
import { readConfig } from '../server/config.js';
import { bootstrapAdmin } from '../server/services/bootstrap-admin.js';
import { createUser } from '../server/services/users.js';
import { createProject, saveProjectMember, updateProject, archiveProject } from '../server/services/projects.js';
import { deleteWorkItem, freezeWorkBasis, listWorkItems, saveWorkItem } from '../server/services/work-items.js';
import { workItemDefaults, type WorkItemInput } from '../shared/work-items.js';
import { createTestDatabase } from './support/database.js';
import { projectInput } from './support/project-fixture.js';

const password = 'KataSandiPekerjaanTes-2026', origin = 'http://127.0.0.1:5173';
const input = (patch: Partial<WorkItemInput> = {}): WorkItemInput => ({ ...workItemDefaults, code: 'A', name: 'Pekerjaan A', unit: 'm³', contractVolume: '10', unitPrice: '100', ...patch });
const group = (code: string, parentId: string | null = null): WorkItemInput => input({ code, name: code, kind: 'GROUP', unit: '', contractVolume: '0', unitPrice: '0', parentId });

test('T11 impor TS menjaga hak akses, hierarki, angka sumber dan mencegah impor ganda', async t => {
  const { a, b, request, db } = await setup(t);
  const path = `/api/projects/${a.id}/work-items/workbook`;
  assert.equal((await request(null, 'GET', path)).statusCode, 401);
  for (const role of ['OWNER', 'ENGINEER', 'INSPECTOR']) {
    assert.equal((await request(role, 'GET', path)).statusCode, 403);
  }
  assert.equal((await request('TEAM_LEADER', 'GET', `/api/projects/${b.id}/work-items/workbook`)).statusCode, 404);
  const preview = (await request('TEAM_LEADER', 'GET', path)).json();
  assert.equal(preview.items.length, 45);
  const payload = { sourceHash: preview.sha256, confirm: true };
  for (const role of ['OWNER', 'ENGINEER', 'INSPECTOR']) assert.equal((await request(role, 'POST', path, payload)).statusCode, 403);
  assert.equal((await request('TEAM_LEADER', 'POST', path, { ...payload, sourceHash: 'stale' })).statusCode, 400);
  const results = await Promise.all([request('TEAM_LEADER', 'POST', path, payload), request('TEAM_LEADER', 'POST', path, payload)]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [201, 409]);
  const list = (await request('TEAM_LEADER', 'GET', `/api/projects/${a.id}/work-items`)).json();
  assert.equal(list.items.length, 45); assert.equal(list.leafCount, 38);
  assert.equal(list.totalWeight, '100.000000');
  const pipe = list.items.find((i: {code: string}) => i.code === 'IV.A.1');
  assert.equal(pipe.name, 'Pengadaan Pipa PVC-Oriental Bi-Axial DN-800 mm (PN16)');
  assert.equal(pipe.contractVolume, '622.000000'); assert.equal(pipe.unitPrice, '13288989.85');
  assert.equal(pipe.parentId, list.items.find((i: {code: string}) => i.code === 'IV.A').id);
  assert.equal(list.items.find((i: {code: string}) => i.code === 'II.2').contractVolume, '622.120198');
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM audit_events WHERE project_id=$1 AND action='IMPORT_WORKBOOK_WORK'", [a.id])).rows[0].n, 1);
});
async function setup(t: TestContext) {
  const sandbox = await createTestDatabase(); t.after(sandbox.close); await migrate(sandbox.db);
  await bootstrapAdmin(sandbox.db, { name: 'Admin', email: 'admin@example.test', password });
  const adminId = (await sandbox.db.query('SELECT id FROM users')).rows[0].id as string;
  const ids: Record<string, string> = { ADMINISTRATOR: adminId };
  for (const role of ['TEAM_LEADER', 'OWNER', 'ENGINEER', 'INSPECTOR']) ids[role] = (await createUser(sandbox.db, adminId, { name: role, email: `${role.toLowerCase()}@example.test`, role, isActive: true, password })).id;
  const a = await createProject(sandbox.db, ids.TEAM_LEADER, projectInput({ teamLeaderId: ids.TEAM_LEADER }));
  const b = await createProject(sandbox.db, adminId, projectInput({ projectCode: 'OTHER' }));
  for (const role of ['OWNER', 'ENGINEER', 'INSPECTOR']) await saveProjectMember(sandbox.db, adminId, a.id, null, { userId: ids[role], role, startDate: a.today, endDate: null, isActive: true });
  const app = buildApp({ db: sandbox.db }); t.after(() => app.close());
  const cookies: Record<string, string> = {};
  async function request(role: string | null, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, payload?: Record<string, unknown>) {
    if (role && !cookies[role]) {
      const logged = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { email: role === 'ADMINISTRATOR' ? 'admin@example.test' : `${role.toLowerCase()}@example.test`, password } });
      assert.equal(logged.statusCode, 200); cookies[role] = String(logged.headers['set-cookie']).split(';')[0];
    }
    return app.inject({ method, url: path, headers: { origin, ...(role ? { cookie: cookies[role] } : {}) }, ...(payload ? { payload } : {}) });
  }
  return { ...sandbox, adminId, ids, a, b, request, app };
}

test('CRUD pekerjaan API, agregat induk, persistensi, audit dan pembatasan lintas role/proyek', async (t) => {
  const { db, schema, ids, a, b, request } = await setup(t), path = `/api/projects/${a.id}/work-items`, other = `/api/projects/${b.id}/work-items`;
  assert.equal((await request(null, 'GET', path)).statusCode, 401);
  const parent = (await request('TEAM_LEADER', 'POST', path, group('I'))).json().item.id as string;
  const created = await request('TEAM_LEADER', 'POST', path, input({ parentId: parent, startDate: a.startDate, endDate: a.endDate }));
  assert.equal(created.statusCode, 201); const id = created.json().item.id as string;
  assert.equal((await request('ADMINISTRATOR', 'POST', path, input())).statusCode, 409);
  assert.equal((await request('TEAM_LEADER', 'POST', path, input({ code: 'Bad', startDate: '2020-01-01', endDate: '2020-01-02' }))).statusCode, 400);
  assert.equal((await request('TEAM_LEADER', 'PATCH', `${path}/${id}`, input({ parentId: parent, contractVolume: '20' }))).statusCode, 200);
  for (const role of ['OWNER', 'ENGINEER', 'INSPECTOR']) {
    const read = await request(role, 'GET', path); assert.equal(read.statusCode, 200); assert.equal(read.json().totalAmount, '2000.00000000'); assert.equal(read.headers['cache-control'], 'no-store');
    assert.equal((await request(role, 'POST', path, input({ code: 'X' }))).statusCode, 403);
    assert.equal((await request(role, 'PATCH', `${path}/${id}`, input())).statusCode, 403);
    assert.equal((await request(role, 'DELETE', `${path}/${id}`, { confirm: true })).statusCode, 403);
  }
  for (const role of ['TEAM_LEADER', 'OWNER', 'ENGINEER', 'INSPECTOR']) {
    assert.equal((await request(role, 'GET', other)).statusCode, 404);
    assert.equal((await request(role, 'POST', other, input())).statusCode, 404);
    assert.equal((await request(role, 'PATCH', `${other}/${id}`, input())).statusCode, 404);
    assert.equal((await request(role, 'DELETE', `${other}/${id}`, { confirm: true })).statusCode, 404);
  }
  assert.equal((await request('ADMINISTRATOR', 'PATCH', `${other}/${id}`, input())).statusCode, 404);
  const reopened = openDatabase(readConfig().databaseUrl, schema);
  try { const stored = await listWorkItems(reopened, ids.TEAM_LEADER, a.id); assert.equal(stored.totalAmount, '2000.00000000'); assert.equal(stored.items[0].amount, stored.items[1].amount); }
  finally { await reopened.end(); }
  assert.equal((await request('TEAM_LEADER', 'DELETE', `${path}/${parent}`, { confirm: true })).statusCode, 409);
  assert.equal((await request('TEAM_LEADER', 'DELETE', `${path}/${id}`, { confirm: false })).statusCode, 400);
  assert.equal((await request('TEAM_LEADER', 'DELETE', `${path}/${id}`, { confirm: true })).statusCode, 204);
  const audit = (await db.query("SELECT action FROM audit_events WHERE entity_type='work_item' ORDER BY created_at")).rows.map((row) => row.action);
  assert.ok(audit.includes('CREATE_WORK_ITEM')); assert.ok(audit.includes('UPDATE_WORK_ITEM')); assert.ok(audit.includes('DELETE_WORK_ITEM'));
});

test('parent lintas proyek, parent item, siklus dan konflik serentak ditolak tanpa perubahan parsial', async (t) => {
  const { db, adminId, a, b } = await setup(t);
  const first = await saveWorkItem(db, adminId, a.id, null, group('I'));
  const child = await saveWorkItem(db, adminId, a.id, null, group('II', first.id));
  const leaf = await saveWorkItem(db, adminId, a.id, null, input());
  const foreign = await saveWorkItem(db, adminId, b.id, null, group('I'));
  for (const parentId of [first.id, child.id]) await assert.rejects(saveWorkItem(db, adminId, a.id, first.id, group('I', parentId)), { code: 'WORK_CYCLE' });
  for (const parentId of [foreign.id, leaf.id]) await assert.rejects(saveWorkItem(db, adminId, a.id, null, group('INVALID', parentId)), { code: 'INVALID_WORK_PARENT' });
  await assert.rejects(db.query('UPDATE work_items SET parent_id=$1 WHERE id=$2', [foreign.id, child.id]), { code: '23503' });
  await assert.rejects(saveWorkItem(db, adminId, a.id, leaf.id, group('A')), { code: 'WORK_KIND_FIXED' });
  const independent = await saveWorkItem(db, adminId, a.id, null, group('III'));
  const mutations = await Promise.allSettled([
    saveWorkItem(db, adminId, a.id, first.id, group('I', independent.id)),
    saveWorkItem(db, adminId, a.id, independent.id, group('III', first.id)),
  ]);
  assert.equal(mutations.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal((await listWorkItems(db, adminId, a.id)).items.length, 4);
  const duplicate = await Promise.allSettled([1, 2].map(() => saveWorkItem(db, adminId, a.id, null, input({ code: 'DUP' }))));
  assert.equal(duplicate.filter((result) => result.status === 'fulfilled').length, 1);
});

test('item dirujuk tidak dapat dihapus; arsip dan perubahan jadwal proyek menjaga integritas pekerjaan', async (t) => {
  const { db, adminId, ids, a } = await setup(t);
  const item = await saveWorkItem(db, adminId, a.id, null, input({ startDate: a.startDate, endDate: a.endDate }));
  // Meniru FK modul berikutnya tanpa menambahkan tabel bisnis palsu ke schema utama.
  await db.query('CREATE TABLE test_work_reference (work_id TEXT REFERENCES work_items(id) ON DELETE RESTRICT)');
  await db.query('INSERT INTO test_work_reference VALUES ($1)', [item.id]);
  await assert.rejects(deleteWorkItem(db, adminId, a.id, item.id, { confirm: true }), { code: 'WORK_REFERENCED' });
  assert.equal((await listWorkItems(db, adminId, a.id)).items.length, 1);
  await assert.rejects(updateProject(db, adminId, a.id, projectInput({ teamLeaderId: ids.TEAM_LEADER, startDate: '2026-07-17' })), { code: 'PROJECT_WORK_DATES' });
  await archiveProject(db, adminId, a.id, { confirm: true, reason: 'Arsip pengujian' });
  assert.equal((await listWorkItems(db, adminId, a.id)).canManage, false);
  await assert.rejects(saveWorkItem(db, adminId, a.id, item.id, input()), { code: 'PROJECT_ARCHIVED' });
});

test('hook pembekuan T04 atomik, idempoten dan mengunci basis tanpa memblokir metadata', async (t) => {
  const { db, adminId, ids, a } = await setup(t);
  await assert.rejects(transaction(db, (client) => freezeWorkBasis(client, ids.TEAM_LEADER, a.id, 'Terbit Rencana Awal')), { code: 'WORK_BASIS_EMPTY' });
  const item = await saveWorkItem(db, ids.TEAM_LEADER, a.id, null, input());
  await assert.rejects(transaction(db, (client) => freezeWorkBasis(client, adminId, a.id, 'Coba Admin')), { statusCode: 403 });
  await assert.rejects(transaction(db, async (client) => { await freezeWorkBasis(client, ids.TEAM_LEADER, a.id, 'Dibatalkan'); throw new Error('Batal penerbitan'); }), /Batal penerbitan/);
  assert.equal((await listWorkItems(db, adminId, a.id)).frozenAt, null);
  assert.equal(await transaction(db, (client) => freezeWorkBasis(client, ids.TEAM_LEADER, a.id, 'Rencana Awal uji')), true);
  assert.equal(await transaction(db, (client) => freezeWorkBasis(client, ids.TEAM_LEADER, a.id, 'Jangan timpa')), false);
  for (const patch of [{ contractVolume: '11' }, { unitPrice: '101' }, { unit: 'm²' }, { code: 'NEW' }, { startDate: a.startDate, endDate: a.endDate }]) await assert.rejects(saveWorkItem(db, adminId, a.id, item.id, input(patch)), { code: 'WORK_BASIS_FROZEN' });
  await assert.rejects(saveWorkItem(db, adminId, a.id, null, input({ code: 'NEW' })), { code: 'WORK_BASIS_FROZEN' });
  await assert.rejects(deleteWorkItem(db, adminId, a.id, item.id, { confirm: true }), { code: 'WORK_BASIS_FROZEN' });
  await saveWorkItem(db, adminId, a.id, item.id, input({ contractVolume: '10.000000', unitPrice: '100.00', name: 'Nama diperjelas', status: 'INACTIVE' }));
  const list = await listWorkItems(db, adminId, a.id);
  assert.equal(list.totalAmount, '1000.00000000'); assert.equal(list.freezeReason, 'Rencana Awal uji');
  assert.equal(list.items[0].name, 'Nama diperjelas');
  await assert.rejects(updateProject(db, adminId, a.id, projectInput({ teamLeaderId: ids.TEAM_LEADER, endDate: '2026-07-24' })), { code: 'WORK_BASIS_FROZEN' });
});
