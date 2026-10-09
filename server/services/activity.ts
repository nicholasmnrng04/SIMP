import type { Pool } from 'pg';
import { activityQuery, type ActivityPage } from '../../shared/activity.js';
import { transaction } from '../db/database.js';
import { AppError } from '../errors.js';
import { auditActionLabels } from './monitoring.js';
import { projectActor, requireProject } from './projects.js';

const pageSize = 25;
const extraLabels: Record<string, string> = {
  UPDATE_OWN_NAME: 'Nama akun diperbarui', CHANGE_OWN_PASSWORD: 'Kata sandi akun diubah',
  UPLOAD_OWN_AVATAR: 'Foto profil diperbarui', DELETE_OWN_AVATAR: 'Foto profil dihapus',
  RECOVER_ADMIN_PASSWORD: 'Kata sandi Administrator dipulihkan',
};

export async function activityPage(db: Pool, actorId: string, input: unknown): Promise<ActivityPage> {
  const q = activityQuery.parse(input);
  return transaction(db, async client => {
    const actor = await projectActor(client, actorId);
    if (actor.role !== 'ADMINISTRATOR' && actor.role !== 'TEAM_LEADER') {
      throw new AppError(403, 'FORBIDDEN', 'Anda tidak memiliki akses ke aktivitas.');
    }
    if (q.projectId) await requireProject(client, actor, q.projectId);
    const params = [q.projectId ?? null, q.action ?? null, q.from ?? null, q.to ?? null, actor.id];
    const scope = actor.role === 'ADMINISTRATOR' ? '' : `AND e.project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_members m WHERE m.project_id=e.project_id AND m.user_id=$5 AND m.role_code='TEAM_LEADER'
      AND m.is_active AND m.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE p.timezone)::date
      AND (m.end_date IS NULL OR m.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE p.timezone)::date)
    )`;
    const base = `FROM audit_events e LEFT JOIN users u ON u.id=e.actor_id
      LEFT JOIN projects p ON p.id=e.project_id
      WHERE ($1::text IS NULL OR e.project_id=$1)
      AND ($2::text IS NULL OR e.action=$2)
      AND ($3::date IS NULL OR e.created_at::date >= $3::date)
      AND ($4::date IS NULL OR e.created_at::date <= $4::date)
      AND $5::text IS NOT NULL ${scope}`;
    const total = Number((await client.query(`SELECT count(*)::int AS total ${base}`, params)).rows[0].total);
    const rows = (await client.query(`SELECT e.id,e.created_at AS date,u.name AS actor,e.action,
      e.project_id AS "projectId",p.project_name AS "projectName",e.entity_type AS "entityType",e.entity_id AS "entityId"
      ${base} ORDER BY e.created_at DESC,e.id DESC LIMIT $6 OFFSET $7`, [...params, pageSize, (q.page - 1) * pageSize])).rows;
    return { total, page: q.page, pageSize, entries: rows.map(row => ({
      id: row.id, date: row.date.toISOString(), actor: row.actor ?? 'Sistem',
      action: extraLabels[row.action] ?? auditActionLabels[row.action] ?? 'Data diperbarui',
      projectId: row.projectId, projectName: row.projectName,
      url: row.projectId ? row.entityType === 'daily_report'
        ? `/proyek/${row.projectId}/laporan/${row.entityId}` : `/proyek/${row.projectId}`
        : actor.role === 'ADMINISTRATOR' && row.entityType === 'user' ? '/pengguna' : null,
    })) };
  });
}
