import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { progressQuery, type ProgressResult, type ProgressSource } from '../../shared/progress.js';
import { transaction } from '../db/database.js';
import { projectActor, requireProject } from './projects.js';
import { loadPlanVersions, effectivePlan } from './plans.js';
import { calculateProgress } from './progress-calculation.js';
import { AppError } from '../errors.js';
import { periods, dateAt, dayIndex, type PeriodType } from '../../shared/plans.js';
import type { Curve } from '../../shared/monitoring.js';

// All future dashboard/report/export consumers must call this service. There is
// no cache or separate progress ledger: T06 commits source replacement atomically.
export async function projectProgress(db: Pool, actorId: string, projectId: string, input: unknown = {}): Promise<ProgressResult> {
  return transaction(db, client => progressInTransaction(client, actorId, projectId, input));
}

// Reuse within report transactions so metadata and progress share the project lock.
export async function progressInTransaction(client: PoolClient, actorId: string, projectId: string, input: unknown = {}): Promise<ProgressResult> {
  const query = progressQuery.parse(input);
    const actor = await projectActor(client, actorId), project = await requireProject(client, actor, projectId);
    // Shared project lock stays held through every read. Approval, plan publication
    // and assignment changes acquire the same row exclusively, preventing mixed revisions.
    const plans = await loadPlanVersions(client, projectId), baseline = plans.find(p => p.isBaseline);
    const cutoff = query.cutoff ?? project.today;
    const start = baseline?.startDate ?? project.start_date;
    const from = query.from ?? (start < cutoff ? start : cutoff);
    if (from > cutoff) throw new AppError(400, 'INVALID_PROGRESS_PERIOD', 'Awal periode tidak boleh melewati tanggal cut-off.');
    const effective = effectivePlan(plans, cutoff);
    const selected = query.planVersionId ? plans.find(p => p.id === query.planVersionId) : effective;
    if (query.planVersionId && !selected) throw new AppError(404, 'PLAN_NOT_FOUND', 'Versi rencana tidak ditemukan di proyek ini.');
    const workItems = (baseline?.basis ?? []).filter(w => w.kind === 'ITEM').map(({ id, code, name }) => ({ id, code, name }));
    if (query.workItemId && !workItems.some(w => w.id === query.workItemId)) throw new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Item pekerjaan tidak ditemukan dalam basis proyek ini.');
    const raw = baseline ? await progressSources(client, projectId, cutoff) : [];
    const calculation = calculateProgress(baseline?.basis ?? [], raw, from, cutoff, selected ?? null);
    const visible = raw.filter(row => (!query.workItemId || row.workItemId === query.workItemId));
    const permitted = visible.filter(row => actor.role !== 'INSPECTOR' || row.createdBy === actor.id);
    const sources: ProgressSource[] = permitted.map(({ createdBy: _createdBy, ...row }) => ({ ...row, approvedAt: row.approvedAt?.toISOString() ?? null,
      bucket: row.reportDate < from ? 'previous' : 'current', reportUrl: `/proyek/${projectId}/laporan/${row.reportId}` })) as ProgressSource[];
    return { ...calculation, projectId, projectName: project.project_name, today: project.today, from, cutoff, calculatedAt: new Date().toISOString(),
      state: !baseline ? 'NO_BASELINE' : !selected ? 'NO_EFFECTIVE_PLAN' : 'READY', basisVersionId: baseline?.id ?? null,
      plans: plans.map(({ id, name, versionNumber, isBaseline, effectiveDate, startDate, endDate }) => ({ id, name, versionNumber, isBaseline, effectiveDate, startDate, endDate })),
      selectedPlanId: selected?.id ?? null, effectivePlanId: effective?.id ?? null, selectionMode: query.planVersionId ? 'EXPLICIT' : 'EFFECTIVE',
      selectedWorkItemId: query.workItemId ?? null, workItems, items: calculation.items.filter(row => !query.workItemId || row.id === query.workItemId),
      sourceCount: visible.length, sources, traceRestricted: permitted.length !== visible.length,
      sourceVersion: createHash('sha256').update(JSON.stringify(raw.map(r => [r.activityId, r.reportId, r.revision, r.reportDate, r.quantity]))).digest('hex') };
}

export async function progressCurveInTransaction(client: PoolClient, projectId: string, cutoff: string, type: PeriodType, comparisonId?: string): Promise<Curve> {
  const plans = await loadPlanVersions(client, projectId), baseline = plans.find(p => p.isBaseline);
  const comparison = comparisonId ? plans.find(p => p.id === comparisonId) : plans.at(-1);
  if (comparisonId && !comparison) throw new AppError(404, 'PLAN_NOT_FOUND', 'Versi rencana tidak ditemukan di proyek ini.');
  if (!baseline) return { baseline: null, comparison: null, comparisonEffective: null, points: [] };
  const end = plans.map(p => p.endDate).sort().at(-1)!;
  const displayedPlan = comparison ?? baseline;
  const dates = new Set(periods(displayedPlan.startDate, end, type, displayedPlan.weekConvention).map(p => p.end));
  dates.add(dateAt(dayIndex(baseline.startDate) - 1));
  if (cutoff >= baseline.startDate && cutoff <= end) dates.add(cutoff);
  const raw = await progressSources(client, projectId, cutoff);
  return { baseline: baseline.name, comparison: comparison?.name ?? null, comparisonEffective: comparison?.effectiveDate ?? null,
    points: [...dates].sort().map(date => {
      const original = calculateProgress(baseline.basis, raw, baseline.startDate, date, baseline);
      const latest = calculateProgress(baseline.basis, raw, baseline.startDate, date, comparison ?? null);
      return { date, baseline: original.total.target.cumulative, latest: latest.total.target.cumulative, actual: date <= cutoff ? original.total.actual.cumulative : null };
    }) };
}

async function progressSources(client: PoolClient, projectId: string, cutoff: string) {
  return (await client.query(`SELECT a.id AS "activityId",a.work_item_id AS "workItemId",a.description,a.quantity,
  r.id AS "reportId",r.logical_id AS "logicalId",r.revision,r.report_number AS "reportNumber",r.report_date AS "reportDate",
      r.plan_version_id AS "reportPlanVersionId",r.created_by AS "createdBy",v.created_at AS "approvedAt",u.name AS "approvedByName"
      FROM approved_report_sources s JOIN daily_reports r ON r.id=s.report_id AND r.project_id=s.project_id AND r.logical_id=s.logical_id
      JOIN daily_report_activities a ON a.report_id=r.id AND a.project_id=r.project_id
      LEFT JOIN report_reviews v ON v.report_id=r.id AND v.kind='APPROVE' LEFT JOIN users u ON u.id=v.actor_id
      WHERE s.project_id=$1 AND r.status='APPROVED' AND r.report_date <= $2::date AND a.quantity IS NOT NULL
      ORDER BY r.report_date,r.id,a.id`, [projectId, cutoff])).rows;
}
