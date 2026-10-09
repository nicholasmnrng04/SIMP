import type { Pool } from 'pg';
import { transaction } from '../db/database.js';
import { projectActor, requireProject, listProjects } from './projects.js';
import { progressInTransaction, progressCurveInTransaction } from './progress.js';
import { monitoringQuery, galleryQuery, type Monitoring, type Gallery, type Dashboard, type DashboardProjectSummary, type HistoryEntry } from '../../shared/monitoring.js';
import { daysBetween } from '../../shared/plans.js';
import { AppError } from '../errors.js';
import { scaled } from '../../shared/work-items.js';
import { centsToMoney } from '../../shared/projects.js';

const reportScope = "($2 <> 'OWNER' OR r.status='APPROVED') AND ($2 <> 'INSPECTOR' OR r.created_by=$3)";
export async function projectMonitoring(db: Pool, actorId: string, projectId: string, input: unknown = {}): Promise<Monitoring> {
  const query = monitoringQuery.parse(input);
  return transaction(db, async client => {
    const actor = await projectActor(client, actorId), project = await requireProject(client, actor, projectId);
    const cutoff = query.cutoff ?? project.today;
    if (cutoff > project.today) throw new AppError(400, 'FUTURE_CUTOFF', 'Tanggal ringkasan tidak boleh melewati hari ini pada proyek.');
    const progress = await progressInTransaction(client, actorId, projectId, { cutoff });
    const effective = progress.plans.find(p => p.id === progress.effectivePlanId), end = effective?.endDate ?? project.end_date;
    const curve = await progressCurveInTransaction(client, projectId, cutoff, query.type, query.planVersionId);
    const reports = (await client.query(`SELECT r.id,r.report_number AS number,r.report_date AS date,r.status FROM daily_reports r
      WHERE r.project_id=$1 AND ${reportScope} ORDER BY r.report_date DESC,r.revision DESC`, [projectId, actor.role, actorId])).rows as Monitoring['reports'];
    const problems = (await client.query(`SELECT r.id AS "reportId",p.data->>'problem' AS problem,p.data->>'status' AS status,r.report_date AS date
      FROM daily_report_problems p JOIN daily_reports r ON r.id=p.report_id
      WHERE r.project_id=$1 AND ${reportScope} AND r.report_date <= $4::date
      AND (r.status <> 'APPROVED' OR EXISTS (SELECT 1 FROM approved_report_sources s WHERE s.report_id=r.id))
      AND p.data->>'status'<>'Selesai' ORDER BY r.report_date DESC,p.position`, [projectId, actor.role, actorId, cutoff])).rows as Monitoring['problems'];
    const notes = (await client.query(`SELECT r.id AS "reportId",v.note,u.name AS actor,v.created_at AS date FROM report_reviews v
      JOIN daily_reports r ON r.id=v.report_id JOIN users u ON u.id=v.actor_id
      WHERE r.project_id=$1 AND ${reportScope} AND v.kind='TECHNICAL_NOTE' ORDER BY v.created_at DESC`, [projectId, actor.role, actorId])).rows.map(r => ({ ...r, date: r.date.toISOString() })) as Monitoring['notes'];
    const ongoing = progress.items.filter(i => i.kind === 'ITEM' && scaled(i.actual.cumulative.quantity!,6)>0n && scaled(i.actual.cumulative.quantity!,6)<scaled(i.contractVolume,6)).map(i=>i.id);
    return { progress, curve, reports, problems, notes, ongoing, contractValue: centsToMoney(project.current_contract_value_cents), scheduleEnd: end, day: Math.max(0, daysBetween(project.start_date, cutoff) + 1), remainingDays: Math.max(0, daysBetween(cutoff, end)) };
  });
}

export async function projectGallery(db: Pool, actorId: string, projectId: string, input: unknown = {}): Promise<Gallery> {
  const q = galleryQuery.parse(input);
  return transaction(db, async client => {
    const actor = await projectActor(client, actorId); await requireProject(client, actor, projectId);
    const rows = (await client.query(`SELECT p.id,p.caption,p.location,p.taken_date AS date,a.description AS activity,a.work_name AS "workName",a.work_item_id AS "workItemId",
      p.report_id AS "reportId",r.report_number AS "reportNumber",r.revision,r.status,p.uploaded_by AS "uploadedBy",u.name AS uploader
      FROM daily_report_photos p JOIN daily_reports r ON r.id=p.report_id AND r.project_id=p.project_id
      JOIN daily_report_activities a ON a.id=p.activity_id AND a.report_id=r.id JOIN users u ON u.id=p.uploaded_by
      WHERE p.project_id=$1 AND ${reportScope}
      AND ($4::date IS NULL OR p.taken_date >= $4::date) AND ($5::date IS NULL OR p.taken_date <= $5::date)
      AND ($6::text IS NULL OR a.work_item_id=$6) AND ($7::text IS NULL OR r.id=$7) AND ($8::text IS NULL OR p.uploaded_by=$8)
      ORDER BY p.taken_date DESC,p.created_at DESC,p.id`, [projectId, actor.role, actorId, q.from ?? null, q.to ?? null, q.workItemId ?? null, q.reportId ?? null, q.uploadedBy ?? null])).rows;
    return { photos: rows.map(r => ({ ...r, url: `/api/projects/${projectId}/reports/${r.reportId}/photos/${r.id}/file` })) as Gallery['photos'] };
  });
}

const labels: Record<string,string> = { PROJECT_STATUS: 'Status proyek diubah', CREATE_MEMBER: 'Penugasan dibuat', UPDATE_MEMBER: 'Penugasan diperbarui', CREATE_PROJECT: 'Proyek dibuat', UPDATE_PROJECT: 'Proyek diperbarui', ARCHIVE_PROJECT: 'Proyek diarsipkan', CHANGE_PROJECT_STATUS: 'Status proyek diubah', SET_PROJECT_STATUS: 'Status proyek diubah', CREATE_WORK_ITEM: 'Pekerjaan dibuat', UPDATE_WORK_ITEM: 'Pekerjaan diperbarui', DELETE_WORK_ITEM: 'Pekerjaan dihapus', FREEZE_WORK_BASIS: 'Basis pekerjaan dikunci', PUBLISH_PLAN: 'Rencana diterbitkan', CREATE_REPORT: 'Laporan dibuat', UPDATE_REPORT: 'Laporan diperbarui', SUBMIT_REPORT: 'Laporan dikirim', APPROVE: 'Laporan disetujui', REQUEST_CHANGES: 'Perbaikan diminta', TECHNICAL_NOTE: 'Catatan teknis', CREATE_REPORT_CORRECTION: 'Koreksi laporan dibuat', UPLOAD_REPORT_PHOTO: 'Foto ditambahkan', DELETE_REPORT_PHOTO: 'Foto dihapus', DELETE_DRAFT_REPORT: 'Draf dihapus', CREATE_USER: 'Pengguna dibuat', UPDATE_USER: 'Pengguna diperbarui', BOOTSTRAP_ADMIN: 'Administrator awal dibuat', SAVE_PROJECT_MEMBER: 'Penugasan diperbarui', CREATE_PROJECT_MEMBER: 'Penugasan dibuat', UPDATE_PROJECT_MEMBER: 'Penugasan diperbarui' };
export const auditActionLabels = labels;
function safeNote(value: string) {
  try { const data = JSON.parse(value); return [data.reason, data.note, data.after ? 'Perubahan data tersimpan; buka sumber untuk keadaan terkini.' : null, data.versionNumber ? `Versi ${data.versionNumber}` : null, data.previousVersionId ? `Versi sebelumnya: ${data.previousVersionId}` : null, data.revision ? `Revisi ${data.revision}` : null, data.editVersion ? `Perubahan ke-${data.editVersion}` : null].filter(v => typeof v === 'string').join(' · '); }
  catch { return ''; }
}
export async function projectHistory(db: Pool, actorId: string, projectId: string): Promise<{ entries: HistoryEntry[] }> {
  return transaction(db, async client => {
    const actor = await projectActor(client, actorId); await requireProject(client, actor, projectId);
    const rows = (await client.query(`SELECT e.id,e.created_at AS date,u.name AS actor,e.action,e.note,e.entity_type,e.entity_id,r.status
      FROM audit_events e LEFT JOIN users u ON u.id=e.actor_id LEFT JOIN daily_reports r ON e.entity_type='daily_report' AND r.id=e.entity_id AND r.project_id=e.project_id
      WHERE e.project_id=$1 AND (e.entity_type <> 'daily_report' OR
        (($2 <> 'OWNER' OR (r.status='APPROVED' AND e.action IN ('APPROVE','CREATE_REPORT_CORRECTION'))) AND ($2 <> 'INSPECTOR' OR r.created_by=$3)))
      ORDER BY e.created_at DESC,e.id`, [projectId, actor.role, actorId])).rows;
    return { entries: rows.map(r => ({ id: r.id, date: r.date.toISOString(), actor: r.actor ?? 'Sistem', action: labels[r.action] ?? 'Data proyek diperbarui', note: safeNote(r.note), status: r.status ?? null,
      url: r.entity_type === 'daily_report' && r.status ? `/proyek/${projectId}/laporan/${r.entity_id}` : r.entity_type === 'plan_version' ? `/proyek/${projectId}/rencana` : null })) };
  });
}

export async function dashboard(db: Pool, actorId: string): Promise<Dashboard> {
  const projects = await listProjects(db, actorId);
  return transaction(db, async client => {
    const actor = await projectActor(client, actorId);
    for (const project of projects) await requireProject(client, actor, project.id);
    const reports = (await client.query(`SELECT r.status,count(*)::int AS count FROM daily_reports r WHERE r.project_id=ANY($1::text[]) AND ${reportScope} GROUP BY r.status`, [projects.map(p => p.id), actor.role, actorId])).rows;
    const count = (status: string) => reports.find(r => r.status === status)?.count ?? 0;
    const projectSummaries: DashboardProjectSummary[] = [];
    for (const project of projects) {
      const progress = await progressInTransaction(client, actorId, project.id, { cutoff: project.today });
      const reportCounts = (await client.query(`SELECT
        count(*) FILTER (WHERE r.report_date=$4::date)::int AS "reportsToday",
        count(*) FILTER (WHERE r.status='SUBMITTED')::int AS "pendingReviews",
        count(*) FILTER (WHERE r.status='NEEDS_REVISION')::int AS "needsRevision",
        count(*) FILTER (WHERE r.status='DRAFT')::int AS drafts
        FROM daily_reports r WHERE r.project_id=$1 AND ${reportScope}`,
        [project.id, actor.role, actorId, project.today])).rows[0];
      const openProblems = (await client.query(`SELECT count(*)::int AS count
        FROM daily_report_problems p JOIN daily_reports r ON r.id=p.report_id
        WHERE r.project_id=$1 AND ${reportScope} AND p.data->>'status'<>'Selesai'
        AND (r.status <> 'APPROVED' OR EXISTS (SELECT 1 FROM approved_report_sources s WHERE s.report_id=r.id))`,
        [project.id, actor.role, actorId])).rows[0].count as number;
      const lastActivity = (await client.query('SELECT created_at FROM audit_events WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1', [project.id])).rows[0]?.created_at as Date | undefined;
      projectSummaries.push({
        projectId: project.id, progressState: progress.state, cutoff: progress.cutoff, calculatedAt: progress.calculatedAt,
        effectivePlanId: progress.effectivePlanId, target: progress.total.target.cumulative, actual: progress.total.actual.cumulative,
        deviation: progress.total.deviation, reportsToday: reportCounts.reportsToday, pendingReviews: reportCounts.pendingReviews,
        needsRevision: reportCounts.needsRevision, drafts: reportCounts.drafts, openProblems,
        lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
      });
    }
    const activity = actor.role === 'ADMINISTRATOR' ? (await client.query(`SELECT e.id,e.created_at AS date,u.name AS actor,e.action FROM audit_events e LEFT JOIN users u ON u.id=e.actor_id ORDER BY e.created_at DESC LIMIT 20`)).rows.map(r => ({ ...r, date: r.date.toISOString(), actor: r.actor ?? 'Sistem', action: labels[r.action] ?? 'Data diperbarui', note: '', status: null, url: null })) as HistoryEntry[] : [];
    const inProgress = projects.filter(p => p.status === 'IN_PROGRESS').length;
    const delayed = projects.filter(p => p.status === 'DELAYED').length;
    return { projects, users: actor.role === 'ADMINISTRATOR' ? (await client.query('SELECT count(*)::int AS count FROM users')).rows[0].count : null,
      projectSummaries, counts: { projects: projects.length, active: inProgress + delayed, inProgress, delayed, completed: projects.filter(p => p.status === 'COMPLETED').length, pending: count('SUBMITTED'), drafts: count('DRAFT'), changes: count('NEEDS_REVISION') }, activity };
  });
}
