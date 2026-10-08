import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { dateSchema } from '../../shared/projects.js';
import { planSchema, periods, newWeekConvention, type PlanContext, type PlanVersion, type PeriodType } from '../../shared/plans.js';
import { scaled, decimal, type WorkItemRecord } from '../../shared/work-items.js';
import { transaction } from '../db/database.js';
import { AppError } from '../errors.js';
import { projectActor, requireProject } from './projects.js';
import { freezeWorkBasis } from './work-items.js';
import { calculatePlan } from './plan-calculation.js';
import { readFileSync } from 'node:fs';
import type { WorkbookTargets } from '../../shared/workbook-targets.js';

const fail = (message: string, status = 400) => new AppError(status, 'INVALID_PLAN', message);
const workSql = `SELECT id,parent_id AS "parentId",kind,code,name,description,unit,contract_volume AS "contractVolume",
  unit_price AS "unitPrice",start_date AS "startDate",end_date AS "endDate",status,notes FROM work_items WHERE project_id=$1 ORDER BY id`;
const token = (basis: WorkItemRecord[]) => createHash('sha256').update(JSON.stringify(basis)).digest('hex');
const workbookTargets: WorkbookTargets = JSON.parse(readFileSync(new URL('../templates/workbook-targets.json', import.meta.url), 'utf8'));
export async function loadPlanVersions(client: PoolClient, projectId: string): Promise<PlanVersion[]> {
  const rows = (await client.query(`SELECT v.id,v.version_number AS "versionNumber",v.is_baseline AS "isBaseline",
    v.previous_version_id AS "previousVersionId",v.name,v.reason,v.description,v.effective_date AS "effectiveDate",
    v.start_date AS "startDate",v.end_date AS "endDate",v.granularity,COALESCE(to_jsonb(v)->>'week_convention','PROJECT_START') AS "weekConvention",v.basis_token AS "basisToken",v.basis,
    v.changed_item_ids AS "changedItemIds",v.schedule_changed AS "scheduleChanged",v.created_by AS "createdBy",
    u.name AS "createdByName",v.created_at AS "createdAt" FROM project_plan_versions v JOIN users u ON u.id=v.created_by
    WHERE v.project_id=$1 ORDER BY v.version_number`, [projectId])).rows;
  const items = (await client.query('SELECT plan_version_id,work_item_id,targets FROM project_plan_items WHERE project_id=$1 ORDER BY work_item_id', [projectId])).rows;
  return rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString(), items: items.filter(item => item.plan_version_id === row.id).map(item => ({ workItemId: item.work_item_id, targets: item.targets })) })) as PlanVersion[];
}
export function effectivePlan(plans: PlanVersion[], cutoff: string) {
  return plans.filter(plan => plan.effectiveDate <= cutoff).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0] ?? null;
}
export async function planContext(db: Pool, actorId: string, projectId: string, cutoff?: string): Promise<PlanContext> {
  if (cutoff) dateSchema.parse(cutoff);
  return transaction(db, async client => {
    const actor = await projectActor(client, actorId), project = await requireProject(client, actor, projectId);
    const plans = await loadPlanVersions(client, projectId), basis = (await client.query<WorkItemRecord>(workSql, [projectId])).rows;
    const date = cutoff ?? project.today;
    return { versions: plans, effectiveVersionId: effectivePlan(plans, date)?.id ?? null, cutoff: date, today: project.today,
      canPublish: !project.archived_at && actor.role === 'TEAM_LEADER', basis, basisToken: token(basis), startDate: project.start_date, endDate: project.end_date };
  });
}
export async function publishPlan(db: Pool, actorId: string, projectId: string, input: unknown) {
  const data = planSchema.parse(input);
  return transaction(db, async client => {
    const actor = await projectActor(client, actorId), project = await requireProject(client, actor, projectId, true);
    if (actor.role !== 'TEAM_LEADER') throw fail('Hanya Team Leader proyek yang dapat menerbitkan rencana.', 403);
    const plans = await loadPlanVersions(client, projectId), previous = plans.at(-1);
    if ((previous?.id ?? null) !== data.previousVersionId) throw fail('Versi terbaru sudah berubah. Muat ulang sebelum menerbitkan.', 409);
    const liveBasis = (await client.query<WorkItemRecord>(workSql, [projectId])).rows;
    if (token(liveBasis) !== data.basisToken) throw fail('Daftar pekerjaan berubah. Muat ulang dan periksa target sebelum menerbitkan.', 409);
    const basis = plans[0]?.basis ?? liveBasis;
    if (data.startDate !== (plans[0]?.startDate ?? project.start_date)) throw fail('Tanggal mulai mengikuti proyek/Rencana Awal dan tidak dapat digeser.');
    if (!previous && (data.endDate !== project.end_date || data.effectiveDate !== data.startDate)) throw fail('Rencana Awal memakai jadwal proyek dan berlaku sejak tanggal mulai.');
    if (previous && (data.effectiveDate <= previous.effectiveDate || data.effectiveDate < project.today)) throw fail('Tanggal berlaku revisi harus setelah versi terakhir dan tidak sebelum hari ini.');
    if (data.effectiveDate < data.startDate || data.effectiveDate > data.endDate) throw fail('Tanggal berlaku harus berada dalam jadwal versi ini.');
    const source = periods(data.startDate, data.endDate, data.granularity, newWeekConvention), leaves = basis.filter(item => item.kind === 'ITEM');
    if (leaves.length !== data.items.length || new Set(data.items.map(item => item.workItemId)).size !== data.items.length || data.items.some(item => !leaves.some(leaf => leaf.id === item.workItemId))) throw fail('Target harus mencakup setiap item pekerjaan proyek tepat satu kali.');
    for (const item of data.items) {
      if (item.targets.length !== source.length) throw fail('Jumlah target harus sesuai periode versi ini.');
      if (item.targets.reduce((sum, value) => sum + scaled(value, 6), 0n) !== 100000000n) throw fail('Jumlah target setiap pekerjaan harus tepat 100%.');
      item.targets = item.targets.map(value => decimal(scaled(value, 6), 6));
    }
    if (!previous) await freezeWorkBasis(client, actorId, projectId, 'Penerbitan Rencana Awal');
    const scheduleChanged = Boolean(previous && (data.endDate !== previous.endDate || data.granularity !== previous.granularity || previous.weekConvention !== newWeekConvention));
    const changedItemIds = data.items.filter(item => scheduleChanged || JSON.stringify(item.targets) !== JSON.stringify(previous?.items.find(old => old.workItemId === item.workItemId)?.targets)).map(item => item.workItemId);
    const id = randomUUID();
    await client.query(`INSERT INTO project_plan_versions
      (id,project_id,version_number,is_baseline,previous_version_id,name,reason,description,effective_date,start_date,end_date,granularity,week_convention,basis_token,basis,changed_item_ids,schedule_changed,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [id, projectId, plans.length + 1, !previous, data.previousVersionId, data.name, data.reason, data.description, data.effectiveDate, data.startDate, data.endDate, data.granularity, newWeekConvention, data.basisToken, JSON.stringify(basis), JSON.stringify(changedItemIds), scheduleChanged, actorId]);
    for (const item of data.items) await client.query('INSERT INTO project_plan_items (plan_version_id,project_id,work_item_id,targets) VALUES ($1,$2,$3,$4)', [id, projectId, item.workItemId, JSON.stringify(item.targets)]);
    await client.query(`INSERT INTO audit_events (id,actor_id,project_id,entity_type,entity_id,action,note) VALUES ($1,$2,$3,'plan_version',$4,'PUBLISH_PLAN',$5)`,
      [randomUUID(), actorId, projectId, id, JSON.stringify({ previousVersionId: data.previousVersionId, versionNumber: plans.length + 1, effectiveDate: data.effectiveDate, reason: data.reason, changedItemIds, scheduleChanged })]);
    return { id };
  });
}
export async function planSeries(db: Pool, actorId: string, projectId: string, versionId: string, type: PeriodType) {
  const context = await planContext(db, actorId, projectId), version = context.versions.find(plan => plan.id === versionId);
  if (!version) throw fail('Versi rencana tidak ditemukan di proyek ini.', 404);
  return calculatePlan(version, version.basis, type);
}

export async function previewWorkbookTargets(db: Pool, actorId: string, projectId: string) {
  const context = await planContext(db, actorId, projectId);
  if (!context.canPublish) throw fail('Hanya Team Leader proyek yang dapat menyiapkan target rencana.', 403);
  const previous = context.versions.at(-1);
  const basis = context.versions[0]?.basis ?? context.basis;
  const source = periods(previous?.startDate ?? context.startDate, previous?.endDate ?? context.endDate, 'WEEKLY', newWeekConvention);
  if (source.length !== workbookTargets.weeks) throw fail('Jumlah minggu proyek tidak cocok dengan jadwal workbook TS.', 409);
  const leaves = basis.filter(item => item.kind === 'ITEM');
  const byCode = new Map(leaves.map(item => [item.code, item]));
  if (leaves.length !== workbookTargets.items.length || byCode.size !== leaves.length) throw fail('Daftar pekerjaan tidak cocok dengan workbook TS.', 409);
  const items = workbookTargets.items.map(row => {
    const item = byCode.get(row.code);
    if (!item || item.name !== row.name || item.unit !== row.unit ||
      scaled(item.contractVolume, 6) !== scaled(row.contractVolume, 6) ||
      scaled(item.unitPrice, 2) !== scaled(row.unitPrice, 2)) throw fail(`Data pekerjaan ${row.code} tidak cocok dengan workbook TS.`, 409);
    const old = previous?.items.find(part => part.workItemId === item.id);
    return { workItemId: item.id, code: row.code, name: row.name, unit: row.unit, contractVolume: row.contractVolume,
      unitPrice: row.unitPrice, targets: row.targets, previousTargets: old?.targets ?? null,
      changed: !old || old.targets.length !== row.targets.length || old.targets.some((part, index) => scaled(part, 6) !== scaled(row.targets[index], 6)) };
  });
  return { source: workbookTargets.source, sha256: workbookTargets.sha256, weeks: source.length,
    previousWeekConvention: previous?.weekConvention ?? null, changedCount: items.filter(item => item.changed).length, items };
}
