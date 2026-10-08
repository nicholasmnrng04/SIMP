import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { WorkbookWork } from '../../shared/workbook-work.js';
import { workItemDefaults, workItemSchema } from '../../shared/work-items.js';
import { transaction } from '../db/database.js';
import { projectActor, requireProject } from './projects.js';
import { AppError } from '../errors.js';

const source: WorkbookWork = JSON.parse(readFileSync(new URL('../templates/workbook-work.json', import.meta.url), 'utf8'));
export async function previewWorkbookWork(db: Pool, actorId: string, projectId: string) {
  return transaction(db, async client => {
    await requireProject(client, await projectActor(client, actorId), projectId, true);
    return source;
  });
}
export async function importWorkbookWork(db: Pool, actorId: string, projectId: string, input: unknown) {
  const data = z.object({ sourceHash: z.literal(source.sha256), confirm: z.literal(true) }).strict().parse(input);
  return transaction(db, async client => {
    const project = await requireProject(client, await projectActor(client, actorId), projectId, true);
    if (project.work_basis_frozen_at) throw new AppError(409, 'WORK_BASIS_FROZEN', 'Basis pekerjaan sudah dikunci.');
    if ((await client.query('SELECT id FROM work_items WHERE project_id=$1 LIMIT 1', [projectId])).rowCount) {
      throw new AppError(409, 'WORK_NOT_EMPTY', 'Impor hanya dapat dilakukan pada daftar pekerjaan kosong; pekerjaan lama tidak ditimpa.');
    }
    const ids = new Map<string, string>();
    for (const row of source.items) {
      if (row.parentCode && !ids.has(row.parentCode)) throw new Error('Urutan kelompok workbook tidak valid.');
      const item = workItemSchema.parse({ ...workItemDefaults, code: row.code, name: row.name, kind: row.kind,
        parentId: row.parentCode ? ids.get(row.parentCode) : null, unit: row.unit, contractVolume: row.contractVolume, unitPrice: row.unitPrice,
        notes: `Sumber ${source.source}, ${row.source}${row.basisSource ? '; ' + row.basisSource : ''}. Volume sumber: ${row.originalVolume}.` });
      const id = randomUUID(); ids.set(row.code, id);
      await client.query(`INSERT INTO work_items (id,project_id,parent_id,kind,code,name,description,unit,contract_volume,unit_price,status,notes,created_by,updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`, [id, projectId, item.parentId, item.kind, item.code, item.name, item.description, item.unit, item.contractVolume, item.unitPrice, item.status, item.notes, actorId]);
    }
    await client.query(`INSERT INTO audit_events (id,actor_id,project_id,entity_type,entity_id,action,note)
      VALUES ($1,$2,$3,'project',$3,'IMPORT_WORKBOOK_WORK',$4)`, [randomUUID(), actorId, projectId, JSON.stringify({ source: source.source, sha256: data.sourceHash, count: ids.size })]);
    return { count: ids.size };
  });
}
