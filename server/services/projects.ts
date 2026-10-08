import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { SessionUser } from '../../shared/contracts.js';
import { archiveSchema, automaticProjectStatus, centsToMoney, memberSchema, moneyToCents, projectSchema, statusSchema } from '../../shared/projects.js';
import type { Project, ProjectMember, TeamCandidate } from '../../shared/projects.js';
import { transaction } from '../db/database.js';
import { AppError } from '../errors.js';
import { progressInTransaction } from './progress.js';
import { scaled } from '../../shared/work-items.js';

const forbidden = () => new AppError(403, 'FORBIDDEN', 'Anda tidak memiliki akses untuk tindakan ini.');
const missing = () => new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan atau tidak ditugaskan kepada Anda.');
const todaySql = "(CURRENT_TIMESTAMP AT TIME ZONE p.timezone)::date";
const activeMembership = `EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = $1
  AND m.role_code = $2 AND m.is_active AND m.start_date <= ${todaySql} AND (m.end_date IS NULL OR m.end_date >= ${todaySql}))`;
const projectSelect = `SELECT p.*, u.name AS team_leader_name, to_char(${todaySql}, 'YYYY-MM-DD') AS today
  FROM projects p LEFT JOIN users u ON u.id = p.team_leader_id`;

export async function projectActor(client: PoolClient, id: string): Promise<SessionUser> {
  const actor = (await client.query<SessionUser>('SELECT id, name, email, role_code AS role FROM users WHERE id = $1 AND is_active FOR SHARE', [id])).rows[0];
  if (!actor) throw new AppError(401, 'UNAUTHENTICATED', 'Sesi Anda berakhir. Silakan masuk kembali.');
  return actor;
}

// Modul berikutnya harus memakai guard ini di dalam transaksi yang sama dengan mutasi.
// Lock proyek juga dipakai semua perubahan tim, sehingga pencabutan penugasan tidak terlewati.
export async function requireProject(client: PoolClient, actor: SessionUser, id: string, write = false, writerRoles = ['ADMINISTRATOR', 'TEAM_LEADER']) {
  const row = (await client.query(`${projectSelect} WHERE p.id = $3 AND ($2 = 'ADMINISTRATOR' OR ${activeMembership})
    FOR ${write ? 'UPDATE' : 'SHARE'} OF p`, [actor.id, actor.role, id])).rows[0];
  if (!row) throw missing();
  // Setelah memperoleh lock, periksa ulang penugasan dengan snapshot statement baru.
  if (actor.role !== 'ADMINISTRATOR') {
    const permitted = await client.query(`SELECT p.id FROM projects p WHERE p.id = $3 AND ${activeMembership}`, [actor.id, actor.role, id]);
    if (!permitted.rowCount) throw missing();
  }
  if (write) {
    if (!writerRoles.includes(actor.role)) throw forbidden();
    if (row.archived_at) throw new AppError(409, 'PROJECT_ARCHIVED', 'Proyek sudah diarsipkan dan hanya dapat dibaca.');
  }
  return row;
}

async function projectDto(row: QueryResultRow, actor: SessionUser, client: PoolClient): Promise<Project> {
  const progress = await progressInTransaction(client, actor.id, row.id);
  const effectiveEnd = progress.plans.find(p => p.id === progress.effectivePlanId)?.endDate ?? row.end_date;
  const contributing = progress.items.filter(item => item.kind === 'ITEM' && scaled(item.amount, 8) > 0n);
  const completed = contributing.length > 0 && contributing.every(item => item.actual.cumulative.quantity === item.contractVolume || scaled(item.actual.cumulative.quantity!, 6) === scaled(item.contractVolume, 6));
  const started = progress.items.some(item => item.kind === 'ITEM' && scaled(item.actual.cumulative.quantity!, 6) > 0n);
  const automaticStatus = completed ? 'COMPLETED' : row.today > effectiveEnd ? 'DELAYED' : started ? 'IN_PROGRESS' : automaticProjectStatus(row.today, row.start_date, effectiveEnd);
  return {
    id: row.id, projectCode: row.project_code, activityName: row.activity_name, projectName: row.project_name,
    location: row.location, fiscalYear: row.fiscal_year, contractNumber: row.contract_number, contractDate: row.contract_date,
    initialContractValue: centsToMoney(row.initial_contract_value_cents), currentContractValue: centsToMoney(row.current_contract_value_cents),
    startDate: row.start_date, endDate: row.end_date, durationDays: row.duration_days,
    clientName: row.client_name, clientAgency: row.client_agency, clientAgencyAddress: row.client_agency_address,
    consultantName: row.consultant_name, contractorName: row.contractor_name ?? '', teamLeaderId: row.team_leader_id, teamLeaderName: row.team_leader_name,
    description: row.description, timezone: row.timezone, today: row.today,
    status: row.status_override ?? automaticStatus, automaticStatus, statusOverride: row.status_override, statusReason: row.status_override_reason,
    archivedAt: row.archived_at?.toISOString() ?? null, archiveReason: row.archive_reason,
    canManage: !row.archived_at && ['ADMINISTRATOR', 'TEAM_LEADER'].includes(actor.role), canAssignLeadership: actor.role === 'ADMINISTRATOR',
  };
}
async function audit(client: PoolClient, actorId: string, id: string, action: string, detail: unknown) {
  await client.query(`INSERT INTO audit_events (id, actor_id, project_id, entity_type, entity_id, action, note)
    VALUES ($1, $2, $3, 'project', $3, $4, $5)`, [randomUUID(), actorId, id, action, JSON.stringify(detail)]);
}
async function change<T>(db: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  try { return await transaction(db, work); }
  catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') throw new AppError(409, 'PROJECT_CONFLICT', 'Kode proyek atau periode penugasan sudah digunakan.');
    throw error;
  }
}

const columns = ['project_code', 'activity_name', 'project_name', 'location', 'fiscal_year', 'contract_number', 'contract_date',
  'initial_contract_value_cents', 'current_contract_value_cents', 'start_date', 'end_date', 'client_name', 'client_agency',
  'client_agency_address', 'consultant_name', 'team_leader_id', 'description', 'contractor_name'];
function projectValues(data: ReturnType<typeof projectSchema.parse>) {
  return [data.projectCode, data.activityName, data.projectName, data.location, data.fiscalYear, data.contractNumber, data.contractDate,
    moneyToCents(data.initialContractValue).toString(), moneyToCents(data.currentContractValue).toString(), data.startDate, data.endDate,
    data.clientName, data.clientAgency, data.clientAgencyAddress, data.consultantName, data.teamLeaderId, data.description, data.contractorName];
}
async function validLeader(client: PoolClient, id: string | null) {
  if (!id) return;
  if (!(await client.query("SELECT id FROM users WHERE id = $1 AND is_active AND role_code = 'TEAM_LEADER' FOR SHARE", [id])).rowCount) {
    throw new AppError(400, 'INVALID_LEADER', 'Pilih Team Leader dengan akun aktif.');
  }
}
async function assignLeader(client: PoolClient, actorId: string, projectId: string, leaderId: string | null, today: string) {
  // Penanggung jawab tunggal; penugasan lama tetap tersimpan sebagai riwayat.
  await client.query("UPDATE project_members SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP, updated_by = $2 WHERE project_id = $1 AND role_code = 'TEAM_LEADER' AND is_active", [projectId, actorId]);
  if (leaderId) {
    await client.query(`INSERT INTO project_members (id, project_id, user_id, role_code, start_date, created_by, updated_by)
      VALUES ($1, $2, $3, 'TEAM_LEADER', $4, $5, $5)
      ON CONFLICT (project_id, user_id, role_code, start_date) DO UPDATE SET is_active = TRUE, end_date = NULL, updated_at = CURRENT_TIMESTAMP, updated_by = EXCLUDED.updated_by`,
    [randomUUID(), projectId, leaderId, today, actorId]);
  }
}

export async function listProjects(db: Pool, actorId: string, options: { q?: string; archived?: boolean; status?: string } = {}) {
  return transaction(db, async (client) => {
    const actor = await projectActor(client, actorId);
    const query = (options.q ?? '').trim().toLowerCase();
    if (query.length > 200) throw new AppError(400, 'INVALID_SEARCH', 'Pencarian maksimal 200 karakter.');
    const result = await client.query(`${projectSelect} WHERE ($2 = 'ADMINISTRATOR' OR ${activeMembership})
      AND ($3::boolean OR p.archived_at IS NULL) ORDER BY p.created_at DESC, p.id`, [actor.id, actor.role, options.archived ?? false]);
    const projects: Project[] = [];
    for (const row of result.rows) projects.push(await projectDto(await requireProject(client, actor, row.id), actor, client));
    return projects.filter((project) =>
      (!options.status || project.status === options.status) && (!query || [project.projectCode, project.projectName, project.activityName, project.contractNumber, project.location].join(' ').toLowerCase().includes(query)));
  });
}
export async function getProject(db: Pool, actorId: string, id: string) {
  return transaction(db, async (client) => { const actor = await projectActor(client, actorId); return projectDto(await requireProject(client, actor, id), actor, client); });
}
export async function teamLeaders(db: Pool, actorId: string): Promise<TeamCandidate[]> {
  return transaction(db, async (client) => {
    if ((await projectActor(client, actorId)).role !== 'ADMINISTRATOR') throw forbidden();
    return (await client.query<TeamCandidate>("SELECT id, name, role_code AS role FROM users WHERE is_active AND role_code = 'TEAM_LEADER' ORDER BY lower(name), id")).rows;
  });
}
export async function createProject(db: Pool, actorId: string, input: unknown, timezone = 'Asia/Jakarta') {
  const parsed = projectSchema.parse(input);
  return change(db, async (client) => {
    const actor = await projectActor(client, actorId);
    if (!['ADMINISTRATOR', 'TEAM_LEADER'].includes(actor.role)) throw forbidden();
    if (actor.role === 'TEAM_LEADER' && parsed.teamLeaderId !== actor.id) throw new AppError(403, 'LEADER_REQUIRED', 'Team Leader pembuat proyek harus menjadi penanggung jawab proyek.');
    await validLeader(client, parsed.teamLeaderId);
    const id = randomUUID();
    const values = [...projectValues(parsed), id, actor.id, timezone];
    await client.query(`INSERT INTO projects (${columns.join(',')}, id, created_by, updated_by, timezone)
      VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')}, $${columns.length + 1}, $${columns.length + 2}, $${columns.length + 2}, $${columns.length + 3})`, values);
    const row = (await client.query(`${projectSelect} WHERE p.id = $1`, [id])).rows[0];
    await assignLeader(client, actor.id, id, parsed.teamLeaderId, row.today);
    await audit(client, actor.id, id, 'CREATE_PROJECT', { data: parsed, timezone, leaderAssignmentStart: row.today });
    return projectDto(row, actor, client);
  });
}
export async function updateProject(db: Pool, actorId: string, id: string, input: unknown) {
  const data = projectSchema.parse(input);
  return change(db, async (client) => {
    const actor = await projectActor(client, actorId), old = await requireProject(client, actor, id, true);
    if (!Object.hasOwn(input as object, 'contractorName')) data.contractorName = old.contractor_name;
    if (actor.role !== 'ADMINISTRATOR' && old.team_leader_id !== data.teamLeaderId) throw new AppError(403, 'LEADER_ADMIN_ONLY', 'Pergantian Team Leader dilakukan Administrator.');
    if (old.start_date !== data.startDate || old.end_date !== data.endDate) {
      if (old.work_basis_frozen_at) throw new AppError(409, 'WORK_BASIS_FROZEN', 'Jadwal proyek sudah terikat basis terkunci. Perubahan harus melalui revisi rencana.');
      if ((await client.query('SELECT id FROM work_items WHERE project_id=$1 AND (start_date < $2::date OR end_date > $3::date) LIMIT 1', [id, data.startDate, data.endDate])).rowCount) {
        throw new AppError(409, 'PROJECT_WORK_DATES', 'Jadwal baru akan membuat pekerjaan berada di luar pelaksanaan proyek. Sesuaikan jadwal pekerjaan terlebih dahulu.');
      }
    }
    if (data.teamLeaderId !== old.team_leader_id) await validLeader(client, data.teamLeaderId);
    await client.query(`UPDATE projects SET ${columns.map((column, i) => `${column} = $${i + 1}`).join(',')}, updated_at = CURRENT_TIMESTAMP, updated_by = $${columns.length + 2} WHERE id = $${columns.length + 1}`, [...projectValues(data), id, actor.id]);
    if (data.teamLeaderId !== old.team_leader_id) await assignLeader(client, actor.id, id, data.teamLeaderId, old.today);
    await audit(client, actor.id, id, 'UPDATE_PROJECT', { before: await projectDto(old, actor, client), after: data });
    return projectDto((await client.query(`${projectSelect} WHERE p.id = $1`, [id])).rows[0], actor, client);
  });
}
export async function changeProjectStatus(db: Pool, actorId: string, id: string, input: unknown) {
  const data = statusSchema.parse(input);
  return change(db, async (client) => {
    const actor = await projectActor(client, actorId), old = await requireProject(client, actor, id, true);
    await client.query('UPDATE projects SET status_override = $2, status_override_reason = $3, updated_by = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id, data.statusOverride, data.reason, actor.id]);
    await audit(client, actor.id, id, 'PROJECT_STATUS', { before: old.status_override, ...data });
    return projectDto((await client.query(`${projectSelect} WHERE p.id = $1`, [id])).rows[0], actor, client);
  });
}
export async function archiveProject(db: Pool, actorId: string, id: string, input: unknown) {
  const data = archiveSchema.parse(input);
  return change(db, async (client) => {
    const actor = await projectActor(client, actorId);
    await requireProject(client, actor, id, true);
    await client.query('UPDATE projects SET archived_at = CURRENT_TIMESTAMP, archived_by = $2, archive_reason = $3, updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id, actor.id, data.reason]);
    await audit(client, actor.id, id, 'ARCHIVE_PROJECT', { reason: data.reason });
  });
}

export async function projectTeam(db: Pool, actorId: string, id: string): Promise<ProjectMember[]> {
  return transaction(db, async (client) => {
    const actor = await projectActor(client, actorId), project = await requireProject(client, actor, id);
    const result = await client.query(`SELECT m.*, u.name, u.email, u.role_code AS current_role, u.is_active AS user_active
      FROM project_members m JOIN users u ON u.id = m.user_id WHERE project_id = $1 ORDER BY m.is_active DESC, lower(u.name), m.start_date DESC`, [id]);
    return result.rows.map((row) => ({ id: row.id, userId: row.user_id, name: row.name,
      ...(['ADMINISTRATOR', 'OWNER', 'TEAM_LEADER'].includes(actor.role) ? { email: row.email } : {}),
      role: row.role_code, currentRole: row.current_role, startDate: row.start_date, endDate: row.end_date,
      isActive: row.is_active, userActive: row.user_active,
      effective: row.is_active && row.user_active && row.role_code === row.current_role && row.start_date <= project.today && (!row.end_date || row.end_date >= project.today),
    }));
  });
}
export async function projectCandidates(db: Pool, actorId: string, id: string): Promise<TeamCandidate[]> {
  return transaction(db, async (client) => {
    const actor = await projectActor(client, actorId);
    await requireProject(client, actor, id, true);
    const roles = actor.role === 'ADMINISTRATOR' ? ['OWNER', 'ENGINEER', 'INSPECTOR'] : ['ENGINEER', 'INSPECTOR'];
    return (await client.query<TeamCandidate>('SELECT id, name, role_code AS role FROM users WHERE is_active AND role_code = ANY($1::text[]) ORDER BY lower(name), id', [roles])).rows;
  });
}
export async function saveProjectMember(db: Pool, actorId: string, id: string, memberId: string | null, input: unknown) {
  const data = memberSchema.parse(input);
  return change(db, async (client) => {
    const actor = await projectActor(client, actorId);
    const project = await requireProject(client, actor, id, true);
    if (actor.role !== 'ADMINISTRATOR' && ['OWNER', 'TEAM_LEADER'].includes(data.role)) throw forbidden();
    const old = memberId ? (await client.query('SELECT * FROM project_members WHERE id = $1 AND project_id = $2', [memberId, id])).rows[0] : null;
    if (memberId && !old) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Penugasan tidak ditemukan di proyek ini.');
    if (old && (old.user_id !== data.userId || old.role_code !== data.role)) throw new AppError(400, 'MEMBER_IDENTITY_FIXED', 'Identitas penugasan tidak dapat diganti. Nonaktifkan penugasan lama lalu tambahkan penugasan baru.');
    if (data.role === 'TEAM_LEADER' && (!memberId || (data.isActive && data.userId !== project.team_leader_id))) {
      throw new AppError(400, 'LEADER_ASSIGNMENT', 'Tetapkan Team Leader melalui informasi proyek. Hanya penugasan TL saat ini yang dapat diaktifkan.');
    }
    const target = (await client.query('SELECT role_code, is_active FROM users WHERE id = $1 FOR SHARE', [data.userId])).rows[0];
    // Penugasan lama dengan role berbeda tetap dapat dinonaktifkan untuk menjaga histori.
    if (!target || (data.isActive && (!target.is_active || target.role_code !== data.role))) throw new AppError(400, 'INVALID_MEMBER', 'Pengguna harus aktif dan role akun harus sesuai penugasan.');
    if (data.isActive && (await client.query(`SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2 AND is_active
      AND ($3::text IS NULL OR id <> $3) AND start_date <= COALESCE($5::date, 'infinity'::date)
      AND (end_date IS NULL OR end_date >= $4::date)`, [id, data.userId, memberId, data.startDate, data.endDate])).rowCount) {
      throw new AppError(409, 'MEMBER_OVERLAP', 'Periode penugasan aktif pengguna ini bertumpang tindih.');
    }
    const savedId = memberId ?? randomUUID();
    if (memberId) await client.query('UPDATE project_members SET start_date = $3, end_date = $4, is_active = $5, updated_by = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND project_id = $2', [memberId, id, data.startDate, data.endDate, data.isActive, actor.id]);
    else await client.query(`INSERT INTO project_members (id, project_id, user_id, role_code, start_date, end_date, is_active, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`, [savedId, id, data.userId, data.role, data.startDate, data.endDate, data.isActive, actor.id]);
    await audit(client, actor.id, id, memberId ? 'UPDATE_MEMBER' : 'CREATE_MEMBER', { memberId: savedId, before: old, after: data });
    return { id: savedId };
  });
}
