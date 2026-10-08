import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { buildApp } from '../server/app.js';
import { migrate } from '../server/db/migrate.js';
import { openDatabase } from '../server/db/database.js';
import { readConfig } from '../server/config.js';
import { bootstrapAdmin } from '../server/services/bootstrap-admin.js';
import { createUser } from '../server/services/users.js';
import { createProject, saveProjectMember, archiveProject } from '../server/services/projects.js';
import { saveWorkItem, listWorkItems } from '../server/services/work-items.js';
import { planContext, publishPlan, planSeries } from '../server/services/plans.js';
import { calculatePlan } from '../server/services/plan-calculation.js';
import { workItemDefaults } from '../shared/work-items.js';
import { dateAt, dayIndex, periods, newWeekConvention, type PlanInput } from '../shared/plans.js';
import { createTestDatabase } from './support/database.js';
import { projectInput } from './support/project-fixture.js';

const password = 'KataSandiRencanaTes-2026', origin = 'http://127.0.0.1:5173';
async function setup(t: TestContext) {
  const sandbox = await createTestDatabase(); t.after(sandbox.close); await migrate(sandbox.db);
  const { db } = sandbox;
  await bootstrapAdmin(db, { name: 'Admin', email: 'admin@example.test', password });
  const admin = (await db.query('SELECT id FROM users')).rows[0].id as string;
  const ids: Record<string, string> = { ADMINISTRATOR: admin };
  for (const role of ['TEAM_LEADER', 'OWNER', 'ENGINEER', 'INSPECTOR']) ids[role] = (await createUser(db, admin, { name: role, email: `${role.toLowerCase()}@example.test`, role, isActive: true, password })).id;
  const today = (await db.query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date AS date")).rows[0].date as string;
  const start = dateAt(dayIndex(today) - 7), end = dateAt(dayIndex(start) + 13);
  const project = await createProject(db, ids.TEAM_LEADER, projectInput({ startDate: start, endDate: end, teamLeaderId: ids.TEAM_LEADER }));
  const other = await createProject(db, admin, projectInput({ projectCode: 'OTHER' }));
  for (const role of ['OWNER','ENGINEER','INSPECTOR']) await saveProjectMember(db, admin, project.id, null, { userId: ids[role], role, startDate: today, endDate: null, isActive: true });
  const item = await saveWorkItem(db, ids.TEAM_LEADER, project.id, null, { ...workItemDefaults, code: 'A', name: 'Item rencana', unit: 'm³', contractVolume: '1000', unitPrice: '100' });
  const context = await planContext(db, ids.TEAM_LEADER, project.id);
  const targetCount = periods(start, end, 'WEEKLY', newWeekConvention).length;
  const input: PlanInput = { previousVersionId: null, basisToken: context.basisToken, name: 'Rencana Awal', reason: 'Penerbitan awal', description: '', effectiveDate: start, startDate: start, endDate: end, granularity: 'WEEKLY', items: [{ workItemId: item.id, targets: Array.from({ length: targetCount }, (_, index) => index === 0 ? '25' : index === targetCount - 1 ? '75' : '0') }] };
  const app = buildApp({ db }); t.after(() => app.close());
  const cookies: Record<string, string> = {};
  async function request(role: string | null, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, payload?: unknown) {
    if (role && !cookies[role]) {
      const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { email: role === 'ADMINISTRATOR' ? 'admin@example.test' : `${role.toLowerCase()}@example.test`, password } });
      assert.equal(login.statusCode, 200); cookies[role] = String(login.headers['set-cookie']).split(';')[0];
    }
    return app.inject({ method, url: path, headers: { origin, ...(role ? { cookie: cookies[role] } : {}) }, ...(payload ? { payload: payload as Record<string, unknown> } : {}) });
  }
  return { ...sandbox, ids, project, other, today, item, input, request };
}

test('Rencana Awal API, freeze, histori revisi, versi efektif/future, snapshot dan persistensi', async t => {
  const { db, schema, ids, project, input, today, request } = await setup(t), path = `/api/projects/${project.id}/plans`;
  const baselineResponse = await request('TEAM_LEADER', 'POST', path, input);
  assert.equal(baselineResponse.statusCode, 201, baselineResponse.body);
  const baselineId = baselineResponse.json().id;
  assert.ok((await listWorkItems(db, ids.TEAM_LEADER, project.id)).frozenAt);
  const initial = (await planContext(db, ids.TEAM_LEADER, project.id)).versions[0];
  const beforeSeries = await planSeries(db, ids.TEAM_LEADER, project.id, baselineId, 'WEEKLY');
  assert.equal(beforeSeries.periods[0].weighted, '25.000000');
  const effectiveDate = dateAt(dayIndex(today) + 1), endDate = dateAt(dayIndex(input.endDate) + 7);
  const revisionCount = periods(input.startDate, endDate, 'WEEKLY', newWeekConvention).length;
  const revision = await publishPlan(db, ids.TEAM_LEADER, project.id, { ...input, previousVersionId: baselineId, name: 'Perubahan Rencana 1', reason: 'Material terlambat', effectiveDate, endDate, items: [{ ...input.items[0], targets: Array.from({ length: revisionCount }, (_, index) => index === 0 ? '10' : index === 1 ? '40' : index === revisionCount - 1 ? '50' : '0') }] });
  const context = await planContext(db, ids.OWNER, project.id, today);
  assert.equal(context.versions.length, 2); assert.equal(context.effectiveVersionId, baselineId);
  assert.deepEqual(context.versions[0], initial);
  assert.equal(context.versions[1].scheduleChanged, true);
  assert.deepEqual(context.versions[1].changedItemIds, [input.items[0].workItemId]);
  assert.equal((await planContext(db, ids.OWNER, project.id, effectiveDate)).effectiveVersionId, revision.id);
  assert.equal((await planContext(db, ids.OWNER, project.id, dateAt(dayIndex(input.startDate) - 1))).effectiveVersionId, null);
  assert.deepEqual(await planSeries(db, ids.OWNER, project.id, baselineId, 'WEEKLY'), beforeSeries);
  assert.deepEqual(calculatePlan(context.versions[1], context.versions[1].basis, 'MONTHLY').periods.at(-1)?.cumulative, '100.000000');
  const reopened = openDatabase(readConfig().databaseUrl, schema);
  try { assert.deepEqual((await planContext(reopened, ids.OWNER, project.id, effectiveDate)).versions, context.versions); } finally { await reopened.end(); }
  await assert.rejects(db.query('UPDATE project_plan_versions SET name=$1 WHERE id=$2', ['Timpa', baselineId]), { code: '23514' });
  await assert.rejects(db.query('DELETE FROM project_plan_items WHERE plan_version_id=$1', [baselineId]), { code: '23514' });
  assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_events WHERE action='PUBLISH_PLAN'")).rows[0].n, 2);
});

test('validasi target, ID lintas proyek, basis stale, tanggal revisi dan rollback publikasi', async t => {
  const { db, ids, project, other, input, item, today } = await setup(t);
  for (const targets of [['20','20'], ['-1','101'], ['0.0000001','99.9999999'], ['100']]) await assert.rejects(publishPlan(db, ids.TEAM_LEADER, project.id, { ...input, items: [{ workItemId: item.id, targets }] }));
  await assert.rejects(publishPlan(db, ids.TEAM_LEADER, project.id, { ...input, items: [input.items[0], input.items[0]] }), /tepat satu/);
  const foreign = await saveWorkItem(db, ids.ADMINISTRATOR, other.id, null, { ...workItemDefaults, code: 'B', name: 'Lain', unit: 'm', contractVolume: '1', unitPrice: '1' });
  await assert.rejects(publishPlan(db, ids.TEAM_LEADER, project.id, { ...input, items: [{ workItemId: foreign.id, targets: input.items[0].targets }] }), /tepat satu/);
  await assert.rejects(publishPlan(db, ids.TEAM_LEADER, project.id, { ...input, basisToken: '0'.repeat(64) }), /pekerjaan berubah/);
  assert.equal((await listWorkItems(db, ids.TEAM_LEADER, project.id)).frozenAt, null);
  // Fail after freeze and version insertion: the transaction must undo all three writes.
  await db.query("CREATE FUNCTION fail_plan_item() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END; $$; CREATE TRIGGER force_plan_failure BEFORE INSERT ON project_plan_items FOR EACH ROW EXECUTE FUNCTION fail_plan_item()");
  await assert.rejects(publishPlan(db, ids.TEAM_LEADER, project.id, input), /forced failure/);
  assert.equal((await listWorkItems(db, ids.TEAM_LEADER, project.id)).frozenAt, null);
  assert.equal((await planContext(db, ids.TEAM_LEADER, project.id)).versions.length, 0);
  await db.query('DROP TRIGGER force_plan_failure ON project_plan_items');
  const baseline = await publishPlan(db, ids.TEAM_LEADER, project.id, input);
  for (const patch of [{ reason: '' }, { effectiveDate: input.startDate }, { effectiveDate: dateAt(dayIndex(today) - 1) }, { effectiveDate: dateAt(dayIndex(input.endDate) + 1) }, { startDate: today }]) {
    await assert.rejects(publishPlan(db, ids.TEAM_LEADER, project.id, { ...input, previousVersionId: baseline.id, effectiveDate: today, ...patch }));
  }
  assert.equal((await planContext(db, ids.TEAM_LEADER, project.id)).versions.length, 1);
});

test('hanya TL boleh publish, semua pembaca ditugaskan, API lintas proyek dan arsip ditolak', async t => {
  const { db, ids, project, other, input, request } = await setup(t), path = `/api/projects/${project.id}/plans`;
  assert.equal((await request(null, 'GET', path)).statusCode, 401);
  for (const role of ['ADMINISTRATOR','OWNER','ENGINEER','INSPECTOR']) {
    assert.equal((await request(role, 'GET', path)).statusCode, 200);
    assert.equal((await request(role, 'POST', path, input)).statusCode, 403);
  }
  assert.equal((await request('TEAM_LEADER', 'POST', `/api/projects/${other.id}/plans`, input)).statusCode, 404);
  assert.equal((await request('OWNER', 'GET', `/api/projects/${other.id}/plans`)).statusCode, 404);
  const baseline = await publishPlan(db, ids.TEAM_LEADER, project.id, input);
  assert.equal((await request('ADMINISTRATOR', 'GET', `/api/projects/${other.id}/plans/${baseline.id}/series?type=WEEKLY`)).statusCode, 404);
  assert.equal((await request('OWNER', 'GET', `${path}/${baseline.id}/series?type=MONTHLY`)).statusCode, 200);
  assert.equal((await request('TEAM_LEADER', 'PATCH', `${path}/${baseline.id}`, { name: 'Timpa' })).statusCode, 404);
  await archiveProject(db, ids.TEAM_LEADER, project.id, { confirm: true, reason: 'Selesai uji' });
  assert.equal((await request('TEAM_LEADER', 'POST', path, input)).statusCode, 409);
});

test('publikasi serentak dan retry tidak menggandakan nomor versi atau tanggal berlaku', async t => {
  const { db, ids, project, input, today } = await setup(t);
  const results = await Promise.allSettled([publishPlan(db, ids.TEAM_LEADER, project.id, input), publishPlan(db, ids.TEAM_LEADER, project.id, input)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const context = await planContext(db, ids.TEAM_LEADER, project.id), baseline = context.versions[0];
  const revisionInput = { ...input, previousVersionId: baseline.id, effectiveDate: today, reason: 'Target berubah' };
  const revisions = await Promise.allSettled([publishPlan(db, ids.TEAM_LEADER, project.id, revisionInput), publishPlan(db, ids.TEAM_LEADER, project.id, revisionInput)]);
  assert.equal(revisions.filter(r => r.status === 'fulfilled').length, 1);
  const plans = (await planContext(db, ids.TEAM_LEADER, project.id)).versions;
  assert.deepEqual(plans.map(p => p.versionNumber), [1,2]);
  await assert.rejects(publishPlan(db, ids.TEAM_LEADER, project.id, { ...revisionInput, previousVersionId: plans[1].id }), /Tanggal berlaku/);
});

test('revisi target tidak mengubah basis atau sumber aktual simulasi untuk pengulangan T07', async t => {
  const { db, ids, project, input, today } = await setup(t);
  const baseline = await publishPlan(db, ids.TEAM_LEADER, project.id, input);
  // Fixture-only source: real approval workflow is introduced in T06/T07.
  await db.query('CREATE TABLE test_approved_source (work_item_id TEXT REFERENCES work_items(id), quantity NUMERIC(18,6), activity_date DATE)');
  await db.query('INSERT INTO test_approved_source VALUES ($1,250,$2)', [input.items[0].workItemId, input.startDate]);
  const sourceBefore = (await db.query('SELECT * FROM test_approved_source')).rows;
  const basisBefore = (await listWorkItems(db, ids.TEAM_LEADER, project.id)).items;
  await publishPlan(db, ids.TEAM_LEADER, project.id, { ...input, previousVersionId: baseline.id, effectiveDate: today, granularity: 'MONTHLY', items: [{ ...input.items[0], targets: ['100'] }] });
  assert.deepEqual((await db.query('SELECT * FROM test_approved_source')).rows, sourceBefore);
  assert.deepEqual((await listWorkItems(db, ids.TEAM_LEADER, project.id)).items, basisBefore);
  assert.equal((await planContext(db, ids.TEAM_LEADER, project.id)).versions[1].basis[0].contractVolume, '1000.000000');
});
