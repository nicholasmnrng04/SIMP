import type { Pool, PoolClient } from 'pg';
import { transaction } from '../db/database.js';
import { projectActor, requireProject } from './projects.js';
import { loadPlanVersions, effectivePlan } from './plans.js';
import { progressInTransaction } from './progress.js';
import { periods, daysBetween } from '../../shared/plans.js';
import { centsToMoney } from '../../shared/projects.js';
import { scaled } from '../../shared/work-items.js';
import { periodReportQuery, type PeriodReport } from '../../shared/period-reports.js';
import { AppError } from '../errors.js';
import type { SessionUser } from '../../shared/contracts.js';

export async function periodReport(db: Pool, actorId: string, projectId: string, input: unknown = {}): Promise<PeriodReport> {
  return transaction(db, client => periodReportInTransaction(client, actorId, projectId, input));
}
export async function periodReportInTransaction(client: PoolClient, actorId: string, projectId: string, input: unknown = {}): Promise<PeriodReport> {
  const query = periodReportQuery.parse(input);
    const actor = await projectActor(client, actorId), project = await requireProject(client, actor, projectId);
    const plans = await loadPlanVersions(client, projectId);
    // Stable period boundaries across plan comparisons, including published extensions.
    const start = plans.find(p => p.isBaseline)?.startDate ?? project.start_date;
    const end = [project.end_date, ...plans.map(p => p.endDate)].sort().at(-1)!;
    if (daysBetween(start, end) > 3659) throw new AppError(400, 'REPORT_SCHEDULE_LIMIT', 'Laporan prototype mendukung jadwal maksimal 3.660 hari.');
    const currentPlan = query.planVersionId ? plans.find(plan => plan.id === query.planVersionId) : effectivePlan(plans, project.today);
    if (query.planVersionId && !currentPlan) throw new AppError(404, 'PLAN_NOT_FOUND', 'Versi rencana tidak ditemukan di proyek ini.');
    const currentChoices = periods(start, end, query.type, currentPlan?.weekConvention);
    const currentPeriod = query.period ? currentChoices.find(p => p.number === Number(query.period)) : currentChoices.find(p => p.start <= project.today && p.end >= project.today) ?? (project.today < start ? currentChoices[0] : currentChoices.at(-1));
    if (!currentPeriod) throw new AppError(400, 'INVALID_PERIOD', 'Periode tidak tersedia pada jadwal proyek.');
    // Historic reports follow the version effective at that period's cutoff.
    // Explicit comparisons retain the requested version's own calendar.
    const selectedPlan = query.planVersionId ? currentPlan : effectivePlan(plans, currentPeriod.end);
    const choices = selectedPlan?.id === currentPlan?.id ? currentChoices : periods(start, end, query.type, selectedPlan?.weekConvention);
    const selected = query.period ? choices.find(p => p.number === Number(query.period)) : choices.find(p => p.start <= project.today && p.end >= project.today) ?? (project.today < start ? choices[0] : choices.at(-1));
    if (!selected) throw new AppError(400, 'INVALID_PERIOD', 'Periode tidak tersedia pada jadwal proyek.');
    const progress = await progressInTransaction(client, actorId, projectId, { from: selected.start, cutoff: selected.end, ...(query.planVersionId ? { planVersionId: query.planVersionId } : {}) });
    const { reports, detailsRestricted } = await approvedPeriodDetails(client, actor, projectId, selected.start, selected.end);
    return { type: query.type, periods: choices, period: selected, progress, reports, detailsRestricted,
      statuses: Object.fromEntries(progress.items.map(item => [item.id, item.kind === 'GROUP' ? 'Kelompok' : scaled(item.contractVolume, 6) === 0n ? 'Tanpa volume kontrak' : scaled(item.actual.cumulative.quantity!, 6) === 0n ? 'Belum Dikerjakan' : scaled(item.actual.cumulative.quantity!, 6) === scaled(item.contractVolume, 6) ? 'Selesai' : 'Sedang Dikerjakan'])),
      identity: { projectName: project.project_name, activityName: project.activity_name, location: project.location, contractNumber: project.contract_number,
        contractDate: project.contract_date, initialContractValue: centsToMoney(project.initial_contract_value_cents), currentContractValue: centsToMoney(project.current_contract_value_cents),
        clientName: project.client_name, consultantName: project.consultant_name, teamLeaderName: project.team_leader_name,
        startDate: start, endDate: project.end_date, scheduleEnd: end, day: daysBetween(start, selected.end) + 1, remainingDays: Math.max(daysBetween(selected.end, end), 0), timezone: project.timezone } };
}

export async function approvedPeriodDetails(client: PoolClient, actor: SessionUser, projectId: string, from: string, cutoff: string) {
    const rows = (await client.query(`SELECT r.id,r.report_number AS number,r.revision,r.report_date AS date,r.created_by,
      r.general_notes AS notes,v.created_at AS "approvedAt",u.name AS "approvedBy"
      FROM approved_report_sources s JOIN daily_reports r ON r.id=s.report_id AND r.project_id=s.project_id AND r.logical_id=s.logical_id
      JOIN report_reviews v ON v.report_id=r.id AND v.kind='APPROVE' JOIN users u ON u.id=v.actor_id
      WHERE s.project_id=$1 AND r.status='APPROVED' AND r.report_date BETWEEN $2::date AND $3::date
      ORDER BY r.report_date,r.report_number`, [projectId, from, cutoff])).rows;
    const visible = rows.filter(r => actor.role !== 'INSPECTOR' || r.created_by === actor.id);
    const ids = visible.map(r => r.id);
    const children: Record<string, { report_id: string; data: unknown }[]> = {};
    for (const table of ['workforce', 'materials', 'problems']) children[table] = (await client.query(`SELECT report_id,data FROM daily_report_${table} WHERE report_id=ANY($1::text[]) ORDER BY report_id,position`, [ids])).rows;
    const reports = visible.map(r => ({ id: r.id, number: r.number, revision: r.revision, date: r.date, notes: r.notes,
      approvedAt: r.approvedAt.toISOString(), approvedBy: r.approvedBy,
      workforce: children.workforce.filter(c => c.report_id === r.id).map(c => c.data),
      materials: children.materials.filter(c => c.report_id === r.id).map(c => c.data),
      problems: children.problems.filter(c => c.report_id === r.id).map(c => c.data) })) as PeriodReport['reports'];
  return { reports, detailsRestricted: visible.length !== rows.length };
}
