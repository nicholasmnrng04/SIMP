import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { scaled, workItemSchema, type WorkItemInput, type WorkItemRecord, type WorkList } from '../../shared/work-items.js';
import { transaction } from '../db/database.js';
import { AppError } from '../errors.js';
import { projectActor, requireProject } from './projects.js';
import { calculateWorkItems } from './work-calculation.js';

const select = `SELECT id, parent_id AS "parentId", kind, code, name, description, unit,
  contract_volume AS "contractVolume", unit_price AS "unitPrice", start_date AS "startDate", end_date AS "endDate", status, notes
  FROM work_items WHERE project_id = $1`;
const basisFields = ['parentId', 'code', 'kind', 'unit', 'startDate', 'endDate'] as const;
const frozen = () => new AppError(409, 'WORK_BASIS_FROZEN', 'Basis pekerjaan sudah dikunci. Volume, harga, satuan, struktur dan jadwal tidak dapat diubah melalui daftar pekerjaan.');
const missing = () => new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Pekerjaan tidak ditemukan di proyek ini.');
async function audit(client: PoolClient, projectId: string, actorId: string, id: string, action: string, detail: unknown) {
  await client.query(`INSERT INTO audit_events (id, actor_id, project_id, entity_type, entity_id, action, note)
    VALUES ($1,$2,$3,'work_item',$4,$5,$6)`, [randomUUID(), actorId, projectId, id, action, JSON.stringify(detail)]);
}
async function mutate<T>(db: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  try { return await transaction(db, work); }
  catch (error) {
    if (typeof error === 'object' && error && 'code' in error) {
      if (error.code === '23505') throw new AppError(409, 'WORK_CODE_EXISTS', 'Kode pekerjaan sudah digunakan dalam proyek ini.');
      if (error.code === '23503') throw new AppError(409, 'WORK_REFERENCED', 'Pekerjaan masih dirujuk data lain dan tidak dapat dihapus.');
    }
    throw error;
  }
}
export async function listWorkItems(db: Pool, actorId: string, projectId: string): Promise<WorkList> {
  return transaction(db, async (client) => {
    const actor = await projectActor(client, actorId), project = await requireProject(client, actor, projectId);
    const rows = (await client.query<WorkItemRecord>(select, [projectId])).rows;
    return { ...calculateWorkItems(rows), canManage: !project.archived_at && ['ADMINISTRATOR', 'TEAM_LEADER'].includes(actor.role),
      frozenAt: project.work_basis_frozen_at?.toISOString() ?? null, freezeReason: project.work_basis_freeze_reason };
  });
}
function validateParent(rows: WorkItemRecord[], parentId: string | null, id: string) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const visited = new Set([id]);
  let cursor = parentId;
  while (cursor) {
    if (visited.has(cursor)) throw new AppError(400, 'WORK_CYCLE', 'Kelompok induk tidak boleh membentuk siklus atau menunjuk dirinya sendiri.');
    visited.add(cursor);
    const parent = byId.get(cursor);
    if (!parent || parent.kind !== 'GROUP') throw new AppError(400, 'INVALID_WORK_PARENT', 'Induk harus berupa kelompok dalam proyek yang sama.');
    cursor = parent.parentId;
  }
}
function changedBasis(old: WorkItemRecord, next: WorkItemInput) {
  return basisFields.some((key) => old[key] !== next[key]) || scaled(old.contractVolume, 6) !== scaled(next.contractVolume, 6) || scaled(old.unitPrice, 2) !== scaled(next.unitPrice, 2);
}
export async function saveWorkItem(db: Pool, actorId: string, projectId: string, itemId: string | null, input: unknown) {
  const data = workItemSchema.parse(input);
  return mutate(db, async (client) => {
    const actor = await projectActor(client, actorId), project = await requireProject(client, actor, projectId, true);
    const rows = (await client.query<WorkItemRecord>(select, [projectId])).rows;
    const old = itemId ? rows.find((row) => row.id === itemId) : null;
    if (itemId && !old) throw missing();
    if (old && old.kind !== data.kind) throw new AppError(400, 'WORK_KIND_FIXED', 'Jenis kelompok/item tidak dapat diganti. Hapus yang belum dirujuk lalu buat kembali bila diperlukan.');
    if (project.work_basis_frozen_at && (!old || changedBasis(old, data))) throw frozen();
    if (data.startDate && data.endDate && (data.startDate < project.start_date || data.endDate > project.end_date)) throw new AppError(400, 'WORK_OUTSIDE_PROJECT', 'Jadwal pekerjaan harus berada dalam tanggal pelaksanaan proyek.');
    const id = itemId ?? randomUUID();
    validateParent(rows, data.parentId, id);
    const values = [id, projectId, data.parentId, data.kind, data.code, data.name, data.description, data.unit, data.contractVolume, data.unitPrice, data.startDate, data.endDate, data.status, data.notes, actor.id];
    if (itemId) await client.query(`UPDATE work_items SET parent_id=$3, kind=$4, code=$5, name=$6, description=$7, unit=$8,
      contract_volume=$9, unit_price=$10, start_date=$11, end_date=$12, status=$13, notes=$14,
      updated_by=$15, updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND project_id=$2`, values);
    else await client.query(`INSERT INTO work_items (id,project_id,parent_id,kind,code,name,description,unit,contract_volume,unit_price,start_date,end_date,status,notes,created_by,updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)`, values);
    await audit(client, projectId, actorId, id, itemId ? 'UPDATE_WORK_ITEM' : 'CREATE_WORK_ITEM', { before: old, after: data });
    return { id };
  });
}
export async function deleteWorkItem(db: Pool, actorId: string, projectId: string, itemId: string, input: unknown) {
  z.object({ confirm: z.literal(true, { error: 'Konfirmasi penghapusan diperlukan.' }) }).strict().parse(input);
  return mutate(db, async (client) => {
    const actor = await projectActor(client, actorId), project = await requireProject(client, actor, projectId, true);
    const old = (await client.query<WorkItemRecord>(`${select} AND id=$2`, [projectId, itemId])).rows[0];
    if (!old) throw missing();
    if (project.work_basis_frozen_at) throw frozen();
    if ((await client.query('SELECT id FROM work_items WHERE project_id=$1 AND parent_id=$2 LIMIT 1', [projectId, itemId])).rowCount) throw new AppError(409, 'WORK_HAS_CHILDREN', 'Kelompok masih memiliki turunan. Pindahkan atau hapus turunan yang belum dirujuk terlebih dahulu.');
    await client.query('DELETE FROM work_items WHERE project_id=$1 AND id=$2', [projectId, itemId]);
    await audit(client, projectId, actorId, itemId, 'DELETE_WORK_ITEM', { before: old });
  });
}

// Tidak diekspos melalui HTTP T03. T04 memanggil ini dalam transaksi penerbitan Rencana Awal.
export async function freezeWorkBasis(client: PoolClient, actorId: string, projectId: string, reason: string): Promise<boolean> {
  const actor = await projectActor(client, actorId), project = await requireProject(client, actor, projectId, true);
  if (actor.role !== 'TEAM_LEADER') throw new AppError(403, 'FORBIDDEN', 'Penguncian Rencana Awal dilakukan Team Leader proyek.');
  if (!reason.trim()) throw new AppError(400, 'FREEZE_REASON_REQUIRED', 'Alasan penguncian wajib diisi.');
  if (project.work_basis_frozen_at) return false;
  const result = calculateWorkItems((await client.query<WorkItemRecord>(select, [projectId])).rows);
  if (!result.leafCount || result.totalWeight === null) throw new AppError(409, 'WORK_BASIS_EMPTY', 'Isi pekerjaan dengan total nilai lebih dari nol sebelum mengunci basis.');
  await client.query('UPDATE projects SET work_basis_frozen_at=CURRENT_TIMESTAMP, work_basis_frozen_by=$2, work_basis_freeze_reason=$3 WHERE id=$1', [projectId, actorId, reason.trim()]);
  await audit(client, projectId, actorId, projectId, 'FREEZE_WORK_BASIS', { reason: reason.trim(), totalAmount: result.totalAmount });
  return true;
}
