import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { SessionUser } from '../../shared/contracts.js';
import { reportListQuery, reportSchema, versionSchema, photoSchema, reviewSchema, correctionSchema, type Report, type Photo, type ReportInput, type ReportList, type ReportWorkflow } from '../../shared/reports.js';
import { position, type WeekConvention } from '../../shared/plans.js';
import { scaled, type WorkItemRecord } from '../../shared/work-items.js';
import { transaction } from '../db/database.js';
import { projectActor, requireProject } from './projects.js';
import { AppError } from '../errors.js';
import { readPhotoBytes, removePhoto, writePhoto } from './photo-files.js';

const fail = (message: string, status = 400) => new AppError(status, 'REPORT_ERROR', message);
const missing = () => fail('Laporan atau foto tidak ditemukan atau tidak dapat diakses.', 404);
const childTables = { workforce: 'daily_report_workforce', weather: 'daily_report_weather', materials: 'daily_report_materials', problems: 'daily_report_problems' } as const;
async function scope(client: PoolClient, actorId: string, projectId: string, write = false) {
  const actor = await projectActor(client, actorId), project = await requireProject(client, actor, projectId, write, ['TEAM_LEADER','INSPECTOR']);
  return { actor, project };
}
async function reportRow(client: PoolClient, actor: SessionUser, projectId: string, reportId: string, write = false, editVersion?: number) {
  const row = (await client.query(`SELECT r.*, u.name AS creator_name FROM daily_reports r JOIN users u ON u.id=r.created_by
    WHERE r.id=$1 AND r.project_id=$2 AND ($3 <> 'OWNER' OR r.status='APPROVED') AND ($3 <> 'INSPECTOR' OR r.created_by=$4)`, [reportId, projectId, actor.role, actor.id])).rows[0];
  if (!row) throw missing();
  if (write) {
    if (row.created_by !== actor.id) throw fail('Anda hanya dapat mengubah laporan milik sendiri.', 403);
    if (!['DRAFT','NEEDS_REVISION'].includes(row.status)) throw fail('Laporan sudah dikirim dan tidak dapat diubah melalui edit biasa.', 409);
    if (row.edit_version !== editVersion) throw fail('Laporan sudah berubah. Muat ulang sebelum menyimpan.', 409);
  }
  return row;
}
async function audit(client: PoolClient, actorId: string, projectId: string, reportId: string, action: string, detail: unknown) {
  await client.query(`INSERT INTO audit_events(id,actor_id,project_id,entity_type,entity_id,action,note) VALUES($1,$2,$3,'daily_report',$4,$5,$6)`, [randomUUID(),actorId,projectId,reportId,action,JSON.stringify(detail)]);
}
async function change<T>(db: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  try { return await transaction(db, work); }
  catch (error) { if (typeof error === 'object' && error && 'code' in error && error.code === '23505') throw fail('Laporan tanggal ini sudah ada untuk pembuat yang sama. Buka laporan tersebut.', 409); throw error; }
}
async function photos(client: PoolClient, projectId: string, reportId: string): Promise<Photo[]> {
  return (await client.query(`SELECT p.id,p.activity_id AS "activityId",a.work_item_id AS "workItemId",p.caption,p.location,p.taken_date AS "takenDate",
    p.uploaded_by AS "uploadedBy",u.name AS "uploadedByName",p.created_at AS "createdAt",p.report_id AS "reportId",r.report_number AS "reportNumber"
    FROM daily_report_photos p JOIN daily_report_activities a ON a.id=p.activity_id JOIN users u ON u.id=p.uploaded_by JOIN daily_reports r ON r.id=p.report_id
    WHERE p.project_id=$1 AND p.report_id=$2 ORDER BY p.created_at,p.id`, [projectId,reportId])).rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString(), url: `/api/projects/${projectId}/reports/${reportId}/photos/${row.id}/file` })) as Photo[];
}
async function workflow(client:PoolClient, actor:SessionUser, row:QueryResultRow, archived:boolean):Promise<ReportWorkflow> {
  const history=(await client.query(`SELECT r.id,r.revision,r.status,r.correction_reason AS "correctionReason",s.report_id=r.id AS "isAuthoritative"
    FROM daily_reports r LEFT JOIN approved_report_sources s ON s.logical_id=r.logical_id WHERE r.logical_id=$1 AND ($2<>'OWNER' OR r.status='APPROVED') ORDER BY r.revision`,[row.logical_id,actor.role])).rows.map(r=>({...r,isAuthoritative:!!r.isAuthoritative}));
  const reviews=(await client.query(`SELECT v.id,v.kind,v.note,u.name AS "actorName",v.created_at AS "createdAt",v.edit_version AS "editVersion" FROM report_reviews v JOIN users u ON u.id=v.actor_id WHERE v.report_id=$1 ORDER BY v.created_at,v.edit_version`,[row.id])).rows.map(r=>({...r,createdAt:r.createdAt.toISOString()}));
  const isAuthoritative=history.some(r=>r.id===row.id&&r.isAuthoritative);
  return {revision:row.revision,logicalId:row.logical_id,correctionReason:row.correction_reason,isAuthoritative,history,reviews,
    canReview:!archived&&actor.role==='TEAM_LEADER'&&row.status==='SUBMITTED',canNote:!archived&&actor.role==='ENGINEER'&&row.status==='SUBMITTED',
    canCorrect:!archived&&isAuthoritative&&actor.id===row.created_by&&['TEAM_LEADER','INSPECTOR'].includes(actor.role)&&history.every(r=>r.status==='APPROVED'),
    canDelete:!archived&&row.status==='DRAFT'&&row.revision===1&&row.created_by===actor.id&&['TEAM_LEADER','INSPECTOR'].includes(actor.role) };
}
export async function getReport(db: Pool, actorId: string, projectId: string, reportId: string): Promise<Report> {
  return transaction(db, client => getReportInTransaction(client, actorId, projectId, reportId));
}
export async function getReportInTransaction(client: PoolClient, actorId: string, projectId: string, reportId: string): Promise<Report> {
    const { actor, project } = await scope(client,actorId,projectId), row = await reportRow(client,actor,projectId,reportId);
    const plan = (await client.query('SELECT name,start_date,end_date,week_convention FROM project_plan_versions WHERE id=$1 AND project_id=$2', [row.plan_version_id,projectId])).rows[0];
    const activities = (await client.query(`SELECT id,work_item_id AS "workItemId",description,location,quantity,unit,work_code AS "workCode",work_name AS "workName",notes FROM daily_report_activities WHERE report_id=$1 ORDER BY id`, [reportId])).rows as Report['activities'];
    const children = {} as Pick<ReportInput,keyof typeof childTables>;
    for (const [key, table] of Object.entries(childTables)) Object.assign(children,{ [key]: (await client.query(`SELECT data FROM ${table} WHERE report_id=$1 ORDER BY position`, [reportId])).rows.map(r => r.data) });
    return { ...children, ...await workflow(client,actor,row,!!project.archived_at), id: row.id, projectId, reportNumber: row.report_number, reportDate: row.report_date, editVersion: row.edit_version, status: row.status,
      generalNotes: row.general_notes, createdBy: row.created_by, createdByName: row.creator_name, createdAt: row.created_at.toISOString(), submittedAt: row.submitted_at?.toISOString() ?? null,
      planVersionId: row.plan_version_id, planName: plan.name, projectName: row.project_name, contractNumber: row.contract_number, contractorName: project.contractor_name ?? '', startDate: plan.start_date, endDate: plan.end_date,
      calendar: position(plan.start_date,plan.end_date,row.report_date,plan.week_convention), workforceTotal: children.workforce.reduce((sum,w) => sum+w.quantity,0), activities, photos: await photos(client,projectId,reportId),
      canEdit: !project.archived_at && ['DRAFT','NEEDS_REVISION'].includes(row.status) && actor.id === row.created_by && ['TEAM_LEADER','INSPECTOR'].includes(actor.role) };
}
export async function listReports(db: Pool, actorId: string, projectId: string, input:unknown={}): Promise<ReportList> {
  const q=reportListQuery.parse(input);
  return transaction(db,async client => {
    const {actor,project} = await scope(client,actorId,projectId);
    const reports = (await client.query(`SELECT r.id,r.report_number AS "reportNumber",r.report_date AS "reportDate",r.status,r.revision,EXISTS(SELECT 1 FROM approved_report_sources s WHERE s.report_id=r.id) AS "isAuthoritative",u.name AS "createdByName",r.created_by AS "createdBy",v.week_convention AS "weekConvention"
      FROM daily_reports r JOIN users u ON u.id=r.created_by JOIN project_plan_versions v ON v.id=r.plan_version_id WHERE r.project_id=$1 AND ($2 <> 'OWNER' OR r.status='APPROVED') AND ($2 <> 'INSPECTOR' OR r.created_by=$3) ORDER BY r.report_date DESC,r.report_number DESC`, [projectId,actor.role,actor.id])).rows as (ReportList['reports'][number] & { weekConvention: WeekConvention })[];
    const basis = (await client.query('SELECT basis FROM project_plan_versions WHERE project_id=$1 AND is_baseline', [projectId])).rows[0]?.basis ?? [];
    const creators=[...new Map(reports.map(r=>[r.createdBy,{id:r.createdBy,name:r.createdByName}])).values()];
    const plans=(await client.query('SELECT start_date,end_date,is_baseline FROM project_plan_versions WHERE project_id=$1',[projectId])).rows;
    const start=plans.find(p=>p.is_baseline)?.start_date??project.start_date,end=[project.end_date,...plans.map(p=>p.end_date)].sort().at(-1);
    const filtered=reports.filter(r=>{if(q.from&&r.reportDate<q.from||q.to&&r.reportDate>q.to||q.status&&r.status!==q.status||q.createdBy&&r.createdBy!==q.createdBy)return false;if(q.week||q.month){const at=position(start,end,r.reportDate,r.weekConvention);if(q.week&&at.week!==Number(q.week)||q.month&&at.month!==Number(q.month))return false;}return true;});
    return { reports:filtered.map(({ weekConvention: _weekConvention, ...report }) => report), creators, canCreate: !project.archived_at && ['TEAM_LEADER','INSPECTOR'].includes(actor.role), today: project.today, workItems: basis as WorkItemRecord[] };
  });
}
export async function saveReport(db: Pool, actorId: string, projectId: string, reportId: string | null, input: unknown) {
  const data = reportSchema.parse(input);
  return change(db,async client => {
    const {actor,project} = await scope(client,actorId,projectId,true);
    const old = reportId ? await reportRow(client,actor,projectId,reportId,true,data.editVersion) : null;
    if (old && old.revision>1 && old.report_date!==data.reportDate) throw fail('Tanggal koreksi mengikuti identitas laporan asli.');
    if (!old && data.editVersion !== 0) throw fail('Versi laporan baru tidak valid.');
    if (data.reportDate > project.today) throw fail('Tanggal laporan tidak boleh melewati hari ini.');
    const plan = (await client.query('SELECT * FROM project_plan_versions WHERE project_id=$1 AND effective_date <= $2::date ORDER BY effective_date DESC LIMIT 1', [projectId,data.reportDate])).rows[0];
    if (!plan || data.reportDate < plan.start_date || data.reportDate > plan.end_date) throw fail('Tanggal laporan harus berada dalam jadwal rencana yang berlaku. Terbitkan Rencana Awal atau revisi jadwal terlebih dahulu.');
    const basis = plan.basis as WorkItemRecord[], totals = new Map<string,bigint>();
    const activities = data.activities.map(a => {
      const work = basis.find(w => w.id === a.workItemId && w.kind === 'ITEM');
      if (a.workItemId && !work) throw fail('Pekerjaan kegiatan harus berupa item dalam proyek dan basis yang sama.');
      if (a.quantity !== null && !work) throw fail('Kegiatan dengan volume wajib memilih pekerjaan.');
      if (work && a.quantity !== null) { const total = (totals.get(work.id) ?? 0n) + scaled(a.quantity,6); totals.set(work.id,total); if (total > scaled(work.contractVolume,6)) throw fail('Jumlah volume kegiatan laporan melebihi volume kontrak pekerjaan.'); }
      return {...a, unit: work?.unit ?? '', workCode: work?.code ?? '', workName: work?.name ?? ''};
    });
    const id = reportId ?? randomUUID();
    if (old) {
      const existingPhotos = await photos(client,projectId,id);
      const oldActivities = (await client.query('SELECT id,work_item_id FROM daily_report_activities WHERE report_id=$1',[id])).rows;
      if (existingPhotos.some(p => !activities.some(a => a.id === p.activityId && a.workItemId === oldActivities.find(o => o.id === p.activityId)?.work_item_id)) || (existingPhotos.length && old.report_date !== data.reportDate)) throw fail('Hapus foto terkait sebelum mengganti tanggal, menghapus kegiatan, atau mengganti pekerjaan yang memiliki foto.',409);
      await client.query(`UPDATE daily_reports SET report_date=$2,plan_version_id=$3,general_notes=$4,edit_version=edit_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[id,data.reportDate,plan.id,data.generalNotes]);
    } else {
      const number = (await client.query('UPDATE projects SET daily_report_counter=daily_report_counter+1 WHERE id=$1 RETURNING daily_report_counter',[projectId])).rows[0].daily_report_counter;
      await client.query(`INSERT INTO daily_reports(id,logical_id,project_id,report_number,report_date,plan_version_id,project_name,contract_number,general_notes,created_by) VALUES($1,$1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,projectId,`LH-${String(number).padStart(5,'0')}`,data.reportDate,plan.id,project.project_name,project.contract_number,data.generalNotes,actorId]);
    }
    await client.query('DELETE FROM daily_report_activities WHERE report_id=$1 AND NOT(id=ANY($2::text[]))',[id,activities.map(a=>a.id)]);
    for (const a of activities) {
      const result = await client.query(`INSERT INTO daily_report_activities(id,report_id,project_id,work_item_id,description,location,quantity,unit,work_code,work_name,notes)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET work_item_id=$4,description=$5,location=$6,quantity=$7,unit=$8,work_code=$9,work_name=$10,notes=$11 WHERE daily_report_activities.report_id=$2`,[a.id,id,projectId,a.workItemId,a.description,a.location,a.quantity,a.unit,a.workCode,a.workName,a.notes]);
      if (!result.rowCount) throw fail('Identitas kegiatan milik laporan lain.');
    }
    for (const [key,table] of Object.entries(childTables) as [keyof typeof childTables,string][]) {
      await client.query(`DELETE FROM ${table} WHERE report_id=$1`,[id]);
      for (const [index,row] of data[key].entries()) await client.query(`INSERT INTO ${table}(id,report_id,position,data) VALUES($1,$2,$3,$4)`,[randomUUID(),id,index,JSON.stringify(row)]);
    }
    await audit(client,actorId,projectId,id,old ? 'UPDATE_REPORT' : 'CREATE_REPORT',{ editVersion: old ? old.edit_version+1 : 1, data });
    return {id};
  });
}
export async function submitReport(db: Pool, actorId: string, projectId: string, reportId: string, input: unknown) {
  const {editVersion} = versionSchema.parse(input);
  return transaction(db,async client => {
    const {actor} = await scope(client,actorId,projectId,true); const row=await reportRow(client,actor,projectId,reportId,true,editVersion);
    await validateApprovedVolume(client,projectId,reportId,row.logical_id,row.plan_version_id);
    if ((await client.query(`SELECT a.id FROM daily_report_activities a WHERE report_id=$1 AND quantity>0 AND NOT EXISTS(SELECT 1 FROM daily_report_photos p WHERE p.activity_id=a.id)`,[reportId])).rowCount) throw fail('Setiap kegiatan dengan volume positif wajib memiliki minimal satu foto sebelum dikirim.');
    await client.query("UPDATE daily_reports SET status='SUBMITTED',submitted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,edit_version=edit_version+1 WHERE id=$1",[reportId]);
    await audit(client,actorId,projectId,reportId,'SUBMIT_REPORT',{editVersion:editVersion+1});
  });
}
export const photoLimit = 5 * 1024 * 1024;
export async function normalizePhoto(data: string, mime: string): Promise<Buffer> {
  if (data.length > 6990508 || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw fail('Isi foto tidak valid atau terlalu besar.');
  const buffer = Buffer.from(data,'base64');
  if (buffer.toString('base64') !== data) throw fail('Isi foto tidak valid.');
  if (!buffer.length || buffer.length > photoLimit) throw fail('Foto maksimal 5 MiB.',413);
  const png = buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), jpeg = buffer[0]===255 && buffer[1]===216 && buffer[2]===255;
  if ((mime !== 'image/png' || !png) && (mime !== 'image/jpeg' || !jpeg)) throw fail('Isi berkas tidak cocok dengan foto JPEG/PNG.');
  try {
    const decoder = sharp(buffer,{limitInputPixels:20000000,failOn:'warning'}), metadata = await decoder.metadata();
    if (!['jpeg','png'].includes(metadata.format ?? '') || (metadata.pages ?? 1)>1) throw new Error('format');
    const result = await decoder.rotate().flatten({background:'#ffffff'}).jpeg({quality:85}).toBuffer();
    if (!process.env.VERCEL) {
      if (result.length>photoLimit) throw new Error('size');
      return result;
    }
    const responseLimit = 3 * 1024 * 1024;
    if (result.length<=responseLimit) return result;
    for (const quality of [75, 65, 55]) {
      const reduced = await sharp(buffer,{limitInputPixels:20000000,failOn:'warning'})
        .rotate().resize({width:3000,height:3000,fit:'inside',withoutEnlargement:true})
        .flatten({background:'#ffffff'}).jpeg({quality}).toBuffer();
      if (reduced.length<=responseLimit) return reduced;
    }
    throw new Error('size');
  } catch { throw fail('Foto rusak, bergerak, terlalu besar, atau melebihi 20 juta piksel. Gunakan JPEG/PNG yang valid.'); }
}
async function removeFile(directory: string,id: string) { try { await removePhoto(directory,id); } catch { console.warn('Berkas foto tidak lagi dirujuk tetapi belum dapat dibersihkan.'); } }
export async function uploadPhoto(db: Pool, directory: string, actorId: string, projectId: string, reportId: string, input: unknown) {
  const data = photoSchema.parse(input), id=randomUUID(); let written=false;
  try { return await transaction(db,async client => {
    const {actor}=await scope(client,actorId,projectId,true), row=await reportRow(client,actor,projectId,reportId,true,data.editVersion);
    if (data.takenDate!==row.report_date) throw fail('Tanggal foto harus sama dengan tanggal laporan.');
    if (!(await client.query('SELECT id FROM daily_report_activities WHERE id=$1 AND report_id=$2',[data.activityId,reportId])).rowCount) throw fail('Pilih kegiatan dari laporan ini.');
    if ((await photos(client,projectId,reportId)).length>=20) throw fail('Maksimal 20 foto per laporan.');
    const buffer=await normalizePhoto(data.data,data.mime);
    await writePhoto(directory,id,buffer); written=true;
    await client.query('INSERT INTO daily_report_photos(id,report_id,project_id,activity_id,caption,location,taken_date,uploaded_by,byte_size) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,reportId,projectId,data.activityId,data.caption,data.location,data.takenDate,actorId,buffer.length]);
    await client.query('UPDATE daily_reports SET edit_version=edit_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1',[reportId]);
    await audit(client,actorId,projectId,reportId,'UPLOAD_REPORT_PHOTO',{photoId:id,activityId:data.activityId,caption:data.caption});
    return {id};
  }); } catch(error) { if(written) await removeFile(directory,id); throw error; }
}
export async function readPhoto(db: Pool,directory: string,actorId: string,projectId: string,reportId: string,photoId: string) {
  return transaction(db,client => readPhotoInTransaction(client,directory,actorId,projectId,reportId,photoId));
}
export async function readPhotoInTransaction(client:PoolClient,directory:string,actorId:string,projectId:string,reportId:string,photoId:string) {
    const {actor}=await scope(client,actorId,projectId); await reportRow(client,actor,projectId,reportId);
    if (!(await client.query('SELECT id FROM daily_report_photos WHERE id=$1 AND report_id=$2 AND project_id=$3',[photoId,reportId,projectId])).rowCount) throw missing();
    try { return await readPhotoBytes(directory,photoId); } catch { throw missing(); }
}
export async function deletePhoto(db: Pool,directory: string,actorId: string,projectId: string,reportId: string,photoId: string,input: unknown) {
  const {editVersion}=versionSchema.parse(input);
  await transaction(db,async client => {
    const {actor}=await scope(client,actorId,projectId,true); await reportRow(client,actor,projectId,reportId,true,editVersion);
    if (!(await client.query('DELETE FROM daily_report_photos WHERE id=$1 AND report_id=$2 AND project_id=$3',[photoId,reportId,projectId])).rowCount) throw missing();
    await client.query('UPDATE daily_reports SET edit_version=edit_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1',[reportId]);
    await audit(client,actorId,projectId,reportId,'DELETE_REPORT_PHOTO',{photoId});
  }); await removeFile(directory,photoId);
}
export async function deleteReport(db: Pool,directory: string,actorId: string,projectId: string,reportId: string,input: unknown) {
  const {editVersion}=versionSchema.parse(input);
  const ids=await transaction(db,async client => {
    const {actor}=await scope(client,actorId,projectId,true), old=await reportRow(client,actor,projectId,reportId,true,editVersion);
    if(old.status!=='DRAFT'||old.revision!==1) throw fail('Laporan yang pernah diperiksa atau merupakan koreksi tidak dapat dihapus.',409);
    const ids=(await photos(client,projectId,reportId)).map(p=>p.id);
    await client.query('DELETE FROM daily_report_photos WHERE report_id=$1',[reportId]);
    await client.query('DELETE FROM daily_report_activities WHERE report_id=$1',[reportId]);
    for (const table of Object.values(childTables)) await client.query(`DELETE FROM ${table} WHERE report_id=$1`,[reportId]);
    await client.query('DELETE FROM daily_reports WHERE id=$1',[reportId]);
    await audit(client,actorId,projectId,reportId,'DELETE_DRAFT_REPORT',{reportNumber:old.report_number,photoIds:ids}); return ids;
  }); for (const id of ids) await removeFile(directory,id);
}
export async function workPhotos(db: Pool,actorId: string,projectId: string,workItemId: string): Promise<Photo[]> {
  return transaction(db,async client=> {
    const {actor}=await scope(client,actorId,projectId);
    if (!(await client.query('SELECT id FROM work_items WHERE id=$1 AND project_id=$2',[workItemId,projectId])).rowCount) throw missing();
    const reports=(await client.query(`SELECT DISTINCT r.id FROM daily_reports r JOIN daily_report_activities a ON a.report_id=r.id WHERE r.project_id=$1 AND a.work_item_id=$2 AND ($3<>'OWNER' OR r.status='APPROVED') AND ($3<>'INSPECTOR' OR r.created_by=$4)`,[projectId,workItemId,actor.role,actor.id])).rows;
    const result:Photo[]=[]; for(const r of reports) result.push(...(await photos(client,projectId,r.id)).filter(p=>p.workItemId===workItemId)); return result;
  });
}

// T07 consumes only activities joined through approved_report_sources. The project
// write lock serializes approvals, team changes and replacement of a contribution.
async function validateApprovedVolume(client:PoolClient,projectId:string,reportId:string,logicalId:string,planId:string) {
  const basis=(await client.query('SELECT basis FROM project_plan_versions WHERE id=$1',[planId])).rows[0].basis as WorkItemRecord[];
  const totals=(await client.query(`SELECT a.work_item_id,sum(a.quantity)::text AS quantity FROM daily_report_activities a
    WHERE a.project_id=$1 AND a.quantity IS NOT NULL AND (a.report_id=$2 OR a.report_id IN
      (SELECT report_id FROM approved_report_sources WHERE project_id=$1 AND logical_id<>$3)) GROUP BY a.work_item_id`,[projectId,reportId,logicalId])).rows;
  for(const total of totals) {
    const work=basis.find(w=>w.id===total.work_item_id&&w.kind==='ITEM');
    if(!work||scaled(total.quantity,6)>scaled(work.contractVolume,6)) throw fail(`Volume kumulatif pekerjaan ${work?.code??''} melebihi volume kontrak. Perbaiki volume laporan.`);
  }
}
async function reviewSnapshot(client:PoolClient,reportId:string) {
  const snapshot:Record<string,unknown>={report:(await client.query('SELECT * FROM daily_reports WHERE id=$1',[reportId])).rows[0]};
  for(const table of ['daily_report_activities','daily_report_photos',...Object.values(childTables)]) snapshot[table]=(await client.query(`SELECT * FROM ${table} WHERE report_id=$1`,[reportId])).rows;
  return snapshot;
}
export async function reviewReport(db:Pool,actorId:string,projectId:string,reportId:string,input:unknown) {
  const data=reviewSchema.parse(input);
  return transaction(db,async client=> {
    const actor=await projectActor(client,actorId);
    await requireProject(client,actor,projectId,true,data.kind==='TECHNICAL_NOTE'?['ENGINEER']:['TEAM_LEADER']);
    const row=await reportRow(client,actor,projectId,reportId);
    if(row.status!=='SUBMITTED'||row.edit_version!==data.editVersion) throw fail('Laporan tidak lagi menunggu pemeriksaan atau sudah berubah. Muat ulang.',409);
    if(data.kind==='APPROVE') {
      if((await client.query(`SELECT id FROM daily_report_activities a WHERE report_id=$1 AND quantity>0 AND NOT EXISTS(SELECT 1 FROM daily_report_photos p WHERE p.activity_id=a.id)`,[reportId])).rowCount) throw fail('Kegiatan dengan volume positif wajib memiliki foto.');
      await validateApprovedVolume(client,projectId,reportId,row.logical_id,row.plan_version_id);
      if(row.previous_report_id && !(await client.query('SELECT 1 FROM approved_report_sources WHERE logical_id=$1 AND report_id=$2',[row.logical_id,row.previous_report_id])).rowCount) throw fail('Sumber koreksi sudah berubah. Muat ulang.',409);
    }
    await client.query(`INSERT INTO report_reviews(id,report_id,actor_id,kind,edit_version,note,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)`,[randomUUID(),reportId,actorId,data.kind,data.editVersion,data.note,JSON.stringify(await reviewSnapshot(client,reportId))]);
    const status=data.kind==='APPROVE'?'APPROVED':data.kind==='REQUEST_CHANGES'?'NEEDS_REVISION':'SUBMITTED';
    await client.query('UPDATE daily_reports SET status=$2,edit_version=edit_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1',[reportId,status]);
    if(data.kind==='APPROVE') await client.query(`INSERT INTO approved_report_sources(logical_id,report_id,project_id) VALUES($1,$2,$3) ON CONFLICT(logical_id) DO UPDATE SET report_id=EXCLUDED.report_id`,[row.logical_id,reportId,projectId]);
    await audit(client,actorId,projectId,reportId,data.kind,{note:data.note,editVersion:data.editVersion+1,previousSource:row.previous_report_id,status});
  });
}
export async function correctReport(db:Pool,directory:string,actorId:string,projectId:string,reportId:string,input:unknown) {
  const data=correctionSchema.parse(input), written:string[]=[];
  try { return await transaction(db,async client=> {
    const {actor}=await scope(client,actorId,projectId,true), row=await reportRow(client,actor,projectId,reportId);
    if(row.created_by!==actorId) throw fail('Koreksi dibuat oleh pembuat laporan yang masih ditugaskan.',403);
    if(row.status!=='APPROVED'||row.edit_version!==data.editVersion) throw fail('Koreksi hanya dapat dibuat dari versi disetujui yang belum berubah.',409);
    if(!(await client.query('SELECT 1 FROM approved_report_sources WHERE logical_id=$1 AND report_id=$2',[row.logical_id,reportId])).rowCount) throw fail('Buat koreksi dari versi sah terbaru.',409);
    if((await client.query("SELECT 1 FROM daily_reports WHERE logical_id=$1 AND status<>'APPROVED'",[row.logical_id])).rowCount) throw fail('Masih ada koreksi yang belum selesai. Buka koreksi tersebut.',409);
    const id=randomUUID();
    await client.query(`INSERT INTO daily_reports(id,logical_id,revision,previous_report_id,correction_reason,project_id,report_number,report_date,plan_version_id,project_name,contract_number,general_notes,created_by)
      SELECT $1,logical_id,revision+1,id,$2,project_id,report_number,report_date,plan_version_id,project_name,contract_number,general_notes,created_by FROM daily_reports WHERE id=$3`,[id,data.reason,reportId]);
    const activityIds=new Map<string,string>();
    for(const a of (await client.query('SELECT id FROM daily_report_activities WHERE report_id=$1',[reportId])).rows) {
      const newId=randomUUID();activityIds.set(a.id,newId);
      await client.query(`INSERT INTO daily_report_activities(id,report_id,project_id,work_item_id,description,location,quantity,unit,work_code,work_name,notes)
        SELECT $1,$2,project_id,work_item_id,description,location,quantity,unit,work_code,work_name,notes FROM daily_report_activities WHERE id=$3`,[newId,id,a.id]);
    }
    for(const table of Object.values(childTables)) for(const child of (await client.query(`SELECT position,data FROM ${table} WHERE report_id=$1`,[reportId])).rows) await client.query(`INSERT INTO ${table}(id,report_id,position,data) VALUES($1,$2,$3,$4)`,[randomUUID(),id,child.position,JSON.stringify(child.data)]);
    for(const photo of (await client.query('SELECT * FROM daily_report_photos WHERE report_id=$1',[reportId])).rows) {
      const photoId=randomUUID();
      await writePhoto(directory,photoId,await readPhotoBytes(directory,photo.id)); written.push(photoId);
      await client.query(`INSERT INTO daily_report_photos(id,report_id,project_id,activity_id,caption,location,taken_date,uploaded_by,created_at,byte_size) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[photoId,id,projectId,activityIds.get(photo.activity_id),photo.caption,photo.location,photo.taken_date,photo.uploaded_by,photo.created_at,photo.byte_size]);
    }
    await audit(client,actorId,projectId,id,'CREATE_REPORT_CORRECTION',{previousReportId:reportId,logicalId:row.logical_id,revision:row.revision+1,reason:data.reason});
    return {id};
  }); } catch(error) { for(const id of written) await removeFile(directory,id); throw error; }
}
