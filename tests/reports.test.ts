import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { readdir,copyFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import sharp from 'sharp';
import { buildApp } from '../server/app.js';
import { migrate,migrationsDirectory } from '../server/db/migrate.js';
import { openDatabase } from '../server/db/database.js';
import { readConfig } from '../server/config.js';
import { bootstrapAdmin } from '../server/services/bootstrap-admin.js';
import { createUser } from '../server/services/users.js';
import { createProject, saveProjectMember, archiveProject } from '../server/services/projects.js';
import { saveWorkItem } from '../server/services/work-items.js';
import { planContext, publishPlan } from '../server/services/plans.js';
import { saveReport,getReport,listReports,submitReport,uploadPhoto,readPhoto,deletePhoto,deleteReport,normalizePhoto,workPhotos,reviewReport,correctReport } from '../server/services/reports.js';
import { emptyReport,reportSchema,type ReportInput,type Report } from '../shared/reports.js';
import { workItemDefaults } from '../shared/work-items.js';
import { dateAt,dayIndex } from '../shared/plans.js';
import { createTestDatabase } from './support/database.js';
import { projectInput } from './support/project-fixture.js';
import { temporaryDirectory } from './helpers.js';
import { projectProgress } from '../server/services/progress.js';
import { periodReport } from '../server/services/period-reports.js';
import { projectMonitoring, projectGallery, projectHistory, dashboard } from '../server/services/monitoring.js';
import { getProject, changeProjectStatus } from '../server/services/projects.js';
import { periods, newWeekConvention } from '../shared/plans.js';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { exportKinds,type ExportDocument } from '../shared/exports.js';

const password='KataSandiLaporanTes-2026',origin='http://127.0.0.1:5173';
const inputOf=(report:Report):ReportInput=>({editVersion:report.editVersion,reportDate:report.reportDate,generalNotes:report.generalNotes,activities:report.activities.map(({id,workItemId,description,location,quantity,notes})=>({id,workItemId,description,location,quantity,notes})),workforce:report.workforce,weather:report.weather,materials:report.materials,problems:report.problems});
async function setup(t:TestContext,legacy=false,weighted=false,endDate='2026-07-23') {
  const sandbox=await createTestDatabase();t.after(sandbox.close);
  if(legacy){const migrationPath=temporaryDirectory(t);for(const file of await readdir(migrationsDirectory))if(file.endsWith('.sql')&&file<'007')await copyFile(path.join(migrationsDirectory,file),path.join(migrationPath,file));await migrate(sandbox.db,migrationPath);}else await migrate(sandbox.db);
  const {db}=sandbox, directory=temporaryDirectory(t);
  await bootstrapAdmin(db,{name:'Admin',email:'admin@example.test',password});const admin=(await db.query('SELECT id FROM users')).rows[0].id as string;
  const ids:Record<string,string>={ADMINISTRATOR:admin};
  for(const role of ['TEAM_LEADER','OWNER','ENGINEER','INSPECTOR'])ids[role]=(await createUser(db,admin,{name:role,email:`${role.toLowerCase()}@example.test`,role,isActive:true,password})).id;
  ids.OTHER_INSPECTOR=(await createUser(db,admin,{name:'Inspector Lain',email:'other_inspector@example.test',role:'INSPECTOR',isActive:true,password})).id;
  // Build legacy fixtures using their historical schema, not today's project writer.
  async function fixtureProject(actorId:string,input:ReturnType<typeof projectInput>) {
    if(!legacy)return createProject(db,actorId,input);
    const id=randomUUID();
    await db.query('INSERT INTO projects(id,project_code,project_name,start_date,end_date,team_leader_id,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$7)',[id,input.projectCode,input.projectName,input.startDate,input.endDate,input.teamLeaderId,actorId]);
    if(input.teamLeaderId)await db.query("INSERT INTO project_members(id,project_id,user_id,role_code,start_date,created_by,updated_by) VALUES($1,$2,$3,'TEAM_LEADER','2020-01-01',$4,$4)",[randomUUID(),id,input.teamLeaderId,admin]);
    return getProject(db,admin,id);
  }
  const project=await fixtureProject(ids.TEAM_LEADER,projectInput({teamLeaderId:ids.TEAM_LEADER,endDate})), other=await fixtureProject(admin,projectInput({projectCode:'OTHER'}));
  for(const key of ['OWNER','ENGINEER','INSPECTOR','OTHER_INSPECTOR'])await saveProjectMember(db,admin,project.id,null,{userId:ids[key],role:key==='OTHER_INSPECTOR'?'INSPECTOR':key,startDate:project.today,endDate:null,isActive:true});
  const item=await saveWorkItem(db,ids.TEAM_LEADER,project.id,null,{...workItemDefaults,code:'A',name:'Galian',unit:'m³',contractVolume:'1000',unitPrice:'100'});
  const secondItem=weighted ? await saveWorkItem(db,ids.TEAM_LEADER,project.id,null,{...workItemDefaults,code:'B',name:'Pipa',unit:'m',contractVolume:'9000',unitPrice:'100'}) : null;
  const targets=periods(project.startDate,project.endDate,'WEEKLY',legacy ? 'PROJECT_START' : newWeekConvention).map((_,i,all)=>i===0?'50':i===all.length-1?'50':'0');
  if (legacy) {
    const basis=(await db.query('SELECT id,parent_id AS "parentId",kind,code,name,description,unit,contract_volume AS "contractVolume",unit_price AS "unitPrice",start_date AS "startDate",end_date AS "endDate",status,notes FROM work_items WHERE project_id=$1 ORDER BY id',[project.id])).rows;
    const basisToken=createHash('sha256').update(JSON.stringify(basis)).digest('hex'),planId=randomUUID();
    await db.query(`INSERT INTO project_plan_versions(id,project_id,version_number,is_baseline,name,reason,effective_date,start_date,end_date,granularity,basis_token,basis,changed_item_ids,schedule_changed,created_by)
      VALUES($1,$2,1,true,'Rencana Awal','Rencana pengujian',$3,$3,$4,'WEEKLY',$5,$6,$7,false,$8)`,[planId,project.id,project.startDate,project.endDate,basisToken,JSON.stringify(basis),JSON.stringify([item.id]),ids.TEAM_LEADER]);
    await db.query('INSERT INTO project_plan_items(plan_version_id,project_id,work_item_id,targets) VALUES($1,$2,$3,$4)',[planId,project.id,item.id,JSON.stringify(targets)]);
  } else {
    const context=await planContext(db,ids.TEAM_LEADER,project.id);
    await publishPlan(db,ids.TEAM_LEADER,project.id,{previousVersionId:null,basisToken:context.basisToken,name:'Rencana Awal',reason:'Rencana pengujian',description:'',startDate:project.startDate,endDate:project.endDate,effectiveDate:project.startDate,granularity:'WEEKLY',items:[{workItemId:item.id,targets},...(secondItem ? [{workItemId:secondItem.id,targets}] : [])]});
  }
  const input:ReportInput={...emptyReport(project.startDate),activities:[{id:randomUUID(),workItemId:item.id,description:'Galian tanah',location:'STA 0+000',quantity:'75',notes:'Catatan kegiatan'}],workforce:[{category:'Lapangan',position:'Operator',quantity:3,identity:'OP-01,OP-02,OP-03',workingHours:'8',notes:'Shift pagi'}],weather:[{period:'PAGI',condition:'BAIK',startTime:'08:00',endTime:'12:00',notes:'Cerah'}],materials:[{type:'DITOLAK',name:'Pipa',quantity:'5',unit:'m',date:project.startDate,reason:'Retak saat diterima',notes:'Dikembalikan'}],problems:[{problem:'Jalan akses licin',date:project.startDate,location:'Akses timur',impact:'Pengiriman tertunda',resolution:'Penambahan kerikil',status:'Sedang Ditangani',notes:'Dipantau'}],generalNotes:'Laporan lengkap'};
  const png=await sharp({create:{width:8,height:8,channels:3,background:'#397860'}}).png().toBuffer();
  const app=buildApp({db,uploadDir:directory});t.after(()=>app.close());const cookies:Record<string,string>={};
  async function request(role:string|null,method:'GET'|'POST'|'PATCH'|'DELETE',url:string,payload?:unknown){
    if(role&&!cookies[role]){const login=await app.inject({method:'POST',url:'/api/auth/login',headers:{origin},payload:{email:role==='ADMINISTRATOR'?'admin@example.test':`${role.toLowerCase()}@example.test`,password}});assert.equal(login.statusCode,200);cookies[role]=String(login.headers['set-cookie']).split(';')[0];}
    return app.inject({method,url,headers:{origin,...(role?{cookie:cookies[role]}:{})},...(payload?{payload:payload as Record<string,unknown>}:{})});
  }
  return {...sandbox,directory,ids,project,other,item,input,png,request};
}
const photoInput=(input:ReportInput,png:Buffer,editVersion=1)=>({editVersion,activityId:input.activities[0].id,caption:'Foto galian',location:'STA 0+000',takenDate:input.reportDate,mime:'image/png',data:png.toString('base64')});

test('T10 delapan keluaran web PDF XLSX, angka sama, hak akses dan filter gabungan',async t=>{
  const f=await setup(t),{db,ids,project,request}=f,id=await submitted(f);
  const root=`/api/projects/${project.id}`;
  assert.equal((await request('OWNER','GET',`${root}/exports?kind=DAILY&reportId=${id}&format=pdf`)).statusCode,404);
  assert.equal((await request('OTHER_INSPECTOR','GET',`${root}/exports?kind=DAILY&reportId=${id}&format=xlsx`)).statusCode,404);
  await reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:3,kind:'APPROVE',note:''});
  for(const kind of exportKinds){const params=new URLSearchParams({kind,...(kind==='DAILY'?{reportId:id}:kind==='WEEKLY'||kind==='MONTHLY'?{period:'1'}:{from:project.startDate,cutoff:project.endDate})});
    const web=await request('OWNER','GET',`${root}/exports?${params}`);assert.equal(web.statusCode,200,web.body);const doc=web.json<ExportDocument>();assert.equal(Object.fromEntries(doc.metadata)['Nama kontraktor'],'Kontraktor Uji');assert.equal(doc.kind,kind);assert.ok(doc.metadata.find(([k])=>k==='Dibuat pada (UTC)'));
    for(const format of ['pdf','xlsx']){const response=await request('OWNER','GET',`${root}/exports?${params}&format=${format}`);assert.equal(response.statusCode,200,response.statusCode===200?'':response.body);assert.equal(response.headers['cache-control'],'no-store');if(format==='pdf'){assert.equal(response.rawPayload.subarray(0,5).toString(),'%PDF-');assert.ok((await PDFDocument.load(response.rawPayload)).getPageCount()>0);}else{const book=new ExcelJS.Workbook();await book.xlsx.load(response.rawPayload as never);for(const [i,table] of doc.tables.entries()){const sheet=book.getWorksheet(`${i+1} ${table.title}`.slice(0,31))!;assert.ok(sheet);table.rows.forEach((row,r)=>row.forEach((v,c)=>assert.equal(sheet.getCell(r+2,c+1).value,v===null?null:table.columns[c].numeric?Number(v):String(v))));}if(kind==='DAILY')assert.equal(book.getWorksheet('Foto')!.getImages().length,1);}}
    if(kind==='WORKFORCE')assert.deepEqual(doc.tables.find(t=>t.title==='Rekap tenaga kerja')!.rows,[['Lapangan','Operator','3','24.00']]);
  }
  for(const role of ['ADMINISTRATOR','TEAM_LEADER','ENGINEER','INSPECTOR'])assert.equal((await request(role,'GET',`${root}/exports?kind=PROGRESS`)).statusCode,200);
  const withoutLogos=(await request('OWNER','GET',`${root}/exports?kind=PROGRESS&workbookLogos=false`)).json<ExportDocument>();assert.ok(withoutLogos.layout?.every(p=>p.artwork?.length===0));
  assert.equal((await request(null,'GET',`${root}/exports?kind=PROGRESS&format=pdf`)).statusCode,401);
  assert.equal((await request('OWNER','GET',`/api/projects/${f.other.id}/exports?kind=PROGRESS&format=xlsx`)).statusCode,404);
  assert.equal((await request('OWNER','GET',`${root}/exports?kind=WEEKLY&period=999`)).statusCode,400);
  const list=await request('TEAM_LEADER','GET',`${root}/reports?from=${project.startDate}&to=${project.endDate}&week=1&month=1&status=APPROVED&createdBy=${ids.INSPECTOR}`);assert.equal(list.statusCode,200);assert.equal(list.json().reports.length,1);
  for(const q of ['week=2','status=DRAFT',`createdBy=${ids.TEAM_LEADER}`])assert.equal((await request('TEAM_LEADER','GET',`${root}/reports?${q}`)).json().reports.length,0);
  assert.equal((await request('OWNER','GET',`${root}/reports?status=DRAFT`)).json().reports.length,0);
  assert.equal((await request('TEAM_LEADER','GET',`${root}/reports?week=0`)).statusCode,400);
  const correction=await correctReport(db,f.directory,ids.INSPECTOR,project.id,id,{editVersion:4,reason:'Koreksi data ekspor'});
  const changed=await getReport(db,ids.INSPECTOR,project.id,correction.id);
  await saveReport(db,ids.INSPECTOR,project.id,correction.id,{...inputOf(changed),workforce:[{...f.input.workforce[0],quantity:2,workingHours:'7.5'}],materials:[...f.input.materials,{...f.input.materials[0],type:'DITERIMA',quantity:'1.25',reason:''},{...f.input.materials[0],type:'DITERIMA',quantity:'2',unit:'kg',reason:''}]});
  const workforce=async()=> (await request('OWNER','GET',`${root}/exports?kind=WORKFORCE&from=${project.startDate}&cutoff=${project.endDate}`)).json<ExportDocument>().tables.find(t=>t.title==='Rekap tenaga kerja')!.rows;
  assert.deepEqual(await workforce(),[['Lapangan','Operator','3','24.00']]);
  await submitReport(db,ids.INSPECTOR,project.id,correction.id,{editVersion:2});await reviewReport(db,ids.TEAM_LEADER,project.id,correction.id,{editVersion:3,kind:'APPROVE',note:''});
  assert.deepEqual(await workforce(),[['Lapangan','Operator','2','15.00']]);
  const materials=(await request('OWNER','GET',`${root}/exports?kind=MATERIALS&from=${project.startDate}&cutoff=${project.endDate}`)).json<ExportDocument>().tables.find(t=>t.title==='Rekap material dan alat')!.rows;
  assert.deepEqual(materials,[['Ditolak','Pipa','m','5.000000'],['Diterima','Pipa','m','1.250000'],['Diterima','Pipa','kg','2.000000']]);
  const empty=(await request('OWNER','GET',`${root}/exports?kind=WORKFORCE&from=${project.endDate}&cutoff=${project.endDate}`)).json<ExportDocument>();assert.equal(empty.tables.find(t=>t.title==='Rekap tenaga kerja')!.rows.length,0);
});

async function submitted(f:Awaited<ReturnType<typeof setup>>,creator='INSPECTOR',quantity='75') {
  const input={...f.input,activities:[{...f.input.activities[0],id:randomUUID(),quantity}]};
  const {id}=await saveReport(f.db,f.ids[creator],f.project.id,null,input);
  await uploadPhoto(f.db,f.directory,f.ids[creator],f.project.id,id,photoInput(input,f.png));
  await submitReport(f.db,f.ids[creator],f.project.id,id,{editVersion:2});
  return id;
}
test('T06 catatan Engineer, perbaikan beralasan, kirim ulang, otorisasi lima role dan TL lain',async t=>{
  const f=await setup(t),{db,ids,project,request}=f,id=await submitted(f),url=`/api/projects/${project.id}/reports/${id}`;
  for(const role of ['ADMINISTRATOR','ENGINEER','INSPECTOR','OWNER'])assert.equal((await request(role,'POST',`${url}/reviews`,{editVersion:3,kind:'APPROVE',note:''})).statusCode,403);
  for(const role of ['ADMINISTRATOR','TEAM_LEADER','INSPECTOR','OWNER'])assert.equal((await request(role,'POST',`${url}/reviews`,{editVersion:3,kind:'TECHNICAL_NOTE',note:'Catatan teknis'})).statusCode,403);
  const outsider=(await createUser(db,ids.ADMINISTRATOR,{name:'TL lain',email:'other@example.test',role:'TEAM_LEADER',isActive:true,password})).id;
  await assert.rejects(reviewReport(db,outsider,project.id,id,{editVersion:3,kind:'APPROVE',note:''}),/ditugaskan/);
  assert.equal((await request('TEAM_LEADER','POST',`${url}/reviews`,{editVersion:3,kind:'REQUEST_CHANGES',note:'  '})).statusCode,400);
  assert.equal((await request('ENGINEER','POST',`${url}/reviews`,{editVersion:3,kind:'TECHNICAL_NOTE',note:'Periksa kembali ukuran galian'})).statusCode,204);
  let report=await getReport(db,ids.INSPECTOR,project.id,id);assert.equal(report.status,'SUBMITTED');assert.equal(report.reviews.length,1);assert.equal(report.canEdit,false);
  await assert.rejects(reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:3,kind:'APPROVE',note:''}),/berubah/);
  await reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:4,kind:'REQUEST_CHANGES',note:'Sesuaikan hasil pengukuran'});
  report=await getReport(db,ids.INSPECTOR,project.id,id);assert.equal(report.status,'NEEDS_REVISION');assert.equal(report.canEdit,true);assert.equal(report.canDelete,false);
  await assert.rejects(deleteReport(db,f.directory,ids.INSPECTOR,project.id,id,{editVersion:5}),/dihapus/);
  await assert.rejects(reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:5,kind:'APPROVE',note:''}),/menunggu/);
  await saveReport(db,ids.INSPECTOR,project.id,id,{...inputOf(report),generalNotes:'Pengukuran sudah diperbaiki'});
  await submitReport(db,ids.INSPECTOR,project.id,id,{editVersion:6});
  await reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:7,kind:'APPROVE',note:'Ukuran sesuai'});
  report=await getReport(db,ids.OWNER,project.id,id);assert.equal(report.status,'APPROVED');assert.equal(report.isAuthoritative,true);assert.equal(report.reviews.length,3);assert.equal(report.canEdit,false);
  assert.equal((await db.query("SELECT snapshot->'report'->>'general_notes' AS note FROM report_reviews WHERE kind='REQUEST_CHANGES'")).rows[0].note,'Laporan lengkap');
  await assert.rejects(saveReport(db,ids.INSPECTOR,project.id,id,inputOf(report)),/sudah dikirim/);
  await assert.rejects(db.query('UPDATE daily_report_activities SET quantity=1 WHERE report_id=$1',[id]),/disetujui/);
  await assert.rejects(db.query("UPDATE daily_reports SET general_notes='silent' WHERE id=$1",[id]),/disetujui/);
});
test('T06 koreksi mempertahankan versi/foto lama, Owner terfilter, satu sumber pengganti dan persistensi',async t=>{
  const f=await setup(t),{db,ids,project,directory,request,schema}=f,id=await submitted(f);
  await reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:3,kind:'APPROVE',note:''});
  const original=await getReport(db,ids.INSPECTOR,project.id,id),bytes=await readPhoto(db,directory,ids.OWNER,project.id,id,original.photos[0].id);
  await assert.rejects(correctReport(db,directory,ids.INSPECTOR,project.id,id,{editVersion:4,reason:''}));
  await assert.rejects(correctReport(db,directory,ids.TEAM_LEADER,project.id,id,{editVersion:4,reason:'Koreksi pengukuran'}),/pembuat/);
  const results=await Promise.allSettled([1,2].map(()=>correctReport(db,directory,ids.INSPECTOR,project.id,id,{editVersion:4,reason:'Pengukuran aktual dikoreksi'})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const correction=results.find(r=>r.status==='fulfilled')!;assert.equal(correction.status,'fulfilled');if(correction.status!=='fulfilled')return;
  const newId=correction.value.id;let revised=await getReport(db,ids.INSPECTOR,project.id,newId);
  assert.equal(revised.revision,2);assert.equal(revised.reportNumber,original.reportNumber);assert.equal(revised.logicalId,id);assert.notEqual(revised.photos[0].id,original.photos[0].id);assert.deepEqual(revised.materials,original.materials);
  assert.equal((await request('OWNER','GET',`/api/projects/${project.id}/reports/${newId}`)).statusCode,404);
  assert.equal((await request('OWNER','GET',revised.photos[0].url)).statusCode,404);
  assert.equal((await getReport(db,ids.OWNER,project.id,id)).history.length,1);
  assert.equal((await getReport(db,ids.OWNER,project.id,id)).isAuthoritative,true);
  await assert.rejects(saveReport(db,ids.INSPECTOR,project.id,newId,{...inputOf(revised),reportDate:'2026-07-17'}),/Tanggal/);
  await deletePhoto(db,directory,ids.INSPECTOR,project.id,newId,revised.photos[0].id,{editVersion:1});
  assert.deepEqual(await readPhoto(db,directory,ids.OWNER,project.id,id,original.photos[0].id),bytes);
  revised=await getReport(db,ids.INSPECTOR,project.id,newId);
  await saveReport(db,ids.INSPECTOR,project.id,newId,{...inputOf(revised),activities:inputOf(revised).activities.map(a=>({...a,quantity:'50'}))});
  revised=await getReport(db,ids.INSPECTOR,project.id,newId);
  await uploadPhoto(db,directory,ids.INSPECTOR,project.id,newId,photoInput(inputOf(revised),f.png,3));
  await submitReport(db,ids.INSPECTOR,project.id,newId,{editVersion:4});
  await reviewReport(db,ids.TEAM_LEADER,project.id,newId,{editVersion:5,kind:'APPROVE',note:'Koreksi benar'});
  assert.equal((await getReport(db,ids.OWNER,project.id,id)).isAuthoritative,false);
  assert.equal((await getReport(db,ids.OWNER,project.id,id)).activities[0].quantity,'75.000000');
  assert.equal((await getReport(db,ids.OWNER,project.id,newId)).isAuthoritative,true);
  assert.equal((await getReport(db,ids.OWNER,project.id,newId)).history.length,2);
  assert.equal((await db.query('SELECT sum(a.quantity)::text AS total FROM daily_report_activities a JOIN approved_report_sources s ON s.report_id=a.report_id')).rows[0].total,'50.000000');
  await assert.rejects(correctReport(db,directory,ids.INSPECTOR,project.id,id,{editVersion:4,reason:'Versi lama'}),/terbaru/);
  const fresh=openDatabase(readConfig().databaseUrl,schema);try{assert.equal((await getReport(fresh,ids.OWNER,project.id,newId)).isAuthoritative,true);assert.deepEqual(await readPhoto(fresh,directory,ids.OWNER,project.id,id,original.photos[0].id),bytes);}finally{await fresh.end();}
});
test('T06 keputusan bersamaan tepat satu efek, kumulatif tidak melebihi kontrak, TL boleh menyetujui miliknya',async t=>{
  const f=await setup(t),{db,ids,project}=f,first=await submitted(f,'INSPECTOR','700'),second=await submitted(f,'TEAM_LEADER','400');
  const results=await Promise.allSettled([first,first,second].map(id=>reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:3,kind:'APPROVE',note:''})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM approved_report_sources')).rows[0].n,1);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM report_reviews WHERE kind='APPROVE'")).rows[0].n,1);
  const pending=(await db.query("SELECT id FROM daily_reports WHERE status='SUBMITTED'")).rows[0].id as string;
  await reviewReport(db,ids.TEAM_LEADER,project.id,pending,{editVersion:3,kind:'REQUEST_CHANGES',note:'Kurangi volume berlebih'});
  const report=await getReport(db,ids.TEAM_LEADER,project.id,pending);
  await saveReport(db,report.createdBy,project.id,pending,{...inputOf(report),activities:inputOf(report).activities.map(a=>({...a,quantity:'100'}))});
  await submitReport(db,report.createdBy,project.id,pending,{editVersion:5});
  const decision=await Promise.allSettled(['APPROVE','REQUEST_CHANGES'].map(kind=>reviewReport(db,ids.TEAM_LEADER,project.id,pending,{editVersion:6,kind,note:'Keputusan bersamaan'})));
  assert.equal(decision.filter(r=>r.status==='fulfilled').length,1);
  const after=await getReport(db,ids.TEAM_LEADER,project.id,pending);
  if(after.status==='NEEDS_REVISION'){await submitReport(db,report.createdBy,project.id,pending,{editVersion:7});await reviewReport(db,ids.TEAM_LEADER,project.id,pending,{editVersion:8,kind:'APPROVE',note:''});}
  assert.equal((await getReport(db,ids.TEAM_LEADER,project.id,second)).status,'APPROVED');
});
test('T06 rollback keputusan dan salinan koreksi tidak meninggalkan sumber atau file parsial',async t=>{
  const f=await setup(t),{db,ids,project,directory}=f,id=await submitted(f);
  await db.query("CREATE FUNCTION fail_source() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced source failure'; END; $$; CREATE TRIGGER force_source BEFORE INSERT OR UPDATE ON approved_report_sources FOR EACH ROW EXECUTE FUNCTION fail_source()");
  await assert.rejects(reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:3,kind:'APPROVE',note:''}),/forced source/);
  assert.equal((await getReport(db,ids.INSPECTOR,project.id,id)).status,'SUBMITTED');assert.equal((await db.query('SELECT count(*)::int AS n FROM report_reviews')).rows[0].n,0);
  await db.query('DROP TRIGGER force_source ON approved_report_sources');await reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:3,kind:'APPROVE',note:''});
  const files=await readdir(directory);
  await db.query("CREATE FUNCTION fail_copy() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced copy failure'; END; $$; CREATE TRIGGER force_copy BEFORE INSERT ON daily_report_photos FOR EACH ROW EXECUTE FUNCTION fail_copy()");
  await assert.rejects(correctReport(db,directory,ids.INSPECTOR,project.id,id,{editVersion:4,reason:'Koreksi ukuran'}),/forced copy/);
  assert.deepEqual(await readdir(directory),files);assert.equal((await getReport(db,ids.INSPECTOR,project.id,id)).history.length,1);assert.equal((await getReport(db,ids.OWNER,project.id,id)).isAuthoritative,true);
});
test('T06 penugasan/akun nonaktif dan proyek arsip menolak pemeriksaan',async t=>{
  const f=await setup(t),{db,ids,project}=f,id=await submitted(f);
  await db.query('UPDATE project_members SET is_active=false WHERE user_id=$1',[ids.ENGINEER]);
  await assert.rejects(reviewReport(db,ids.ENGINEER,project.id,id,{editVersion:3,kind:'TECHNICAL_NOTE',note:'Catatan teknis'}),/ditugaskan/);
  await db.query('UPDATE users SET is_active=false WHERE id=$1',[ids.TEAM_LEADER]);
  await assert.rejects(reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:3,kind:'APPROVE',note:''}),/Sesi/);
  await db.query('UPDATE users SET is_active=true WHERE id=$1',[ids.TEAM_LEADER]);
  await archiveProject(db,ids.TEAM_LEADER,project.id,{confirm:true,reason:'Proyek diarsipkan'});
  await assert.rejects(reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:3,kind:'APPROVE',note:''}),/arsip/);
});
test('T06 migration dari T05 mempertahankan identitas, isian dan foto serta memilih sumber lama',async t=>{
  const {db,ids,project,item,directory,png}=await setup(t,true);
  const planId=(await db.query('SELECT id FROM project_plan_versions WHERE project_id=$1',[project.id])).rows[0].id;
  const reportId=randomUUID(),activityId=randomUUID(),photoId=randomUUID();
  // Fixture schema lama, sebelum fitur review tersedia. Upgrade tidak menulis ulang datanya.
  await db.query(`INSERT INTO daily_reports(id,project_id,report_number,report_date,plan_version_id,project_name,contract_number,general_notes,created_by,status)
    VALUES($1,$2,'LH-00001',$3,$4,'Proyek lama','Kontrak lama','Catatan sebelum migration',$5,'APPROVED')`,[reportId,project.id,project.startDate,planId,ids.INSPECTOR]);
  await db.query(`INSERT INTO daily_report_activities(id,report_id,project_id,work_item_id,description,location,quantity,unit,work_code,work_name,notes) VALUES($1,$2,$3,$4,'Kegiatan lama','Lokasi lama',75,'m','A','Galian','Tetap')`,[activityId,reportId,project.id,item.id]);
  const jpg=await normalizePhoto(png.toString('base64'),'image/png');await writeFile(path.join(directory,`${photoId}.jpg`),jpg);
  await db.query('INSERT INTO daily_report_photos(id,report_id,project_id,activity_id,caption,location,taken_date,uploaded_by,byte_size) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[photoId,reportId,project.id,activityId,'Foto lama','Lokasi lama',project.startDate,ids.INSPECTOR,jpg.length]);
  const before=(await db.query('SELECT * FROM daily_reports WHERE id=$1',[reportId])).rows[0];
  const through007=temporaryDirectory(t);for(const file of await readdir(migrationsDirectory))if(file.endsWith('.sql')&&file<'008')await copyFile(path.join(migrationsDirectory,file),path.join(through007,file));
  assert.equal(await migrate(db,through007),1);
  const oldHistory=(await db.query('SELECT * FROM schema_migrations ORDER BY name')).rows;
  assert.equal(oldHistory.at(-1).checksum,'4ae65c6756fcf69b075431ceb95156e9aa19129f2013fcfeac1098022f1cdc18');
  assert.equal(await migrate(db),3);assert.equal(await migrate(db),0);
  assert.deepEqual((await db.query('SELECT * FROM schema_migrations ORDER BY name')).rows.slice(0,7),oldHistory);
  const after=(await db.query('SELECT * FROM daily_reports WHERE id=$1',[reportId])).rows[0];for(const key of Object.keys(before))assert.deepEqual(after[key],before[key]);
  const report=await getReport(db,ids.OWNER,project.id,reportId);assert.equal(report.revision,1);assert.equal(report.logicalId,reportId);assert.equal(report.isAuthoritative,true);assert.equal(report.activities[0].id,activityId);assert.equal(report.photos[0].id,photoId);
  assert.deepEqual(await readPhoto(db,directory,ids.OWNER,project.id,reportId,photoId),jpg);
});

test('laporan lengkap, rincian child, hitungan tanggal, edit, foto tetap terhubung dan persistensi koneksi baru',async t=>{
  const {db,schema,directory,ids,project,input,png,request}=await setup(t),url=`/api/projects/${project.id}/reports`;
  const response=await request('INSPECTOR','POST',url,input);assert.equal(response.statusCode,201,response.body);const id=response.json().id as string;
  let report=await getReport(db,ids.INSPECTOR,project.id,id);assert.equal(report.reportNumber,'LH-00001');assert.equal(report.calendar.day,1);assert.equal(report.calendar.week,1);assert.equal(report.calendar.remainingDays,7);assert.equal(report.workforceTotal,3);assert.equal(report.activities[0].unit,'m³');
  for(const key of ['workforce','weather','materials','problems'] as const)assert.deepEqual(report[key],input[key]);
  await uploadPhoto(db,directory,ids.INSPECTOR,project.id,id,photoInput(input,png));report=await getReport(db,ids.INSPECTOR,project.id,id);
  await saveReport(db,ids.INSPECTOR,project.id,id,{...inputOf(report),generalNotes:'Catatan diperbarui'});
  report=await getReport(db,ids.INSPECTOR,project.id,id);assert.equal(report.photos.length,1);assert.equal(report.generalNotes,'Catatan diperbarui');assert.deepEqual(report.materials,input.materials);
  const photo=await request('ENGINEER','GET',report.photos[0].url);assert.equal(photo.statusCode,200);assert.equal(photo.headers['content-type'],'image/jpeg');assert.equal(photo.headers['cache-control'],'no-store');assert.equal(photo.headers['x-content-type-options'],'nosniff');assert.equal((await sharp(photo.rawPayload).metadata()).format,'jpeg');
  assert.equal((await workPhotos(db,ids.TEAM_LEADER,project.id,input.activities[0].workItemId!)).length,1);
  const fresh=openDatabase(readConfig().databaseUrl,schema);try{assert.deepEqual(await getReport(fresh,ids.INSPECTOR,project.id,id),report);assert.ok((await readPhoto(fresh,directory,ids.INSPECTOR,project.id,id,report.photos[0].id)).length);}finally{await fresh.end();}
});
test('validasi kegiatan, pekerja, material, cuaca, volume, tanggal efektif dan aktivitas naratif',async t=>{
  const {db,ids,project,other,input,item}=await setup(t);
  assert.equal(reportSchema.safeParse({...input,activities:[]}).success,false);
  for(const patch of [{activities:[{...input.activities[0],description:''}]},{workforce:[{...input.workforce[0],quantity:-1}]},{materials:[{...input.materials[0],reason:''}]},{weather:[{...input.weather[0],endTime:'07:00'}]},{weather:[input.weather[0],input.weather[0]]}])assert.equal(reportSchema.safeParse({...input,...patch}).success,false);
  const otherItem=await saveWorkItem(db,ids.ADMINISTRATOR,other.id,null,{...workItemDefaults,code:'B',name:'Lain',unit:'m',contractVolume:'5',unitPrice:'1'});
  for(const activities of [[{...input.activities[0],workItemId:otherItem.id}],[{...input.activities[0],workItemId:null}],[{...input.activities[0],quantity:'1001'}],[{...input.activities[0],quantity:'600'},{...input.activities[0],id:randomUUID(),quantity:'600'}]])await assert.rejects(saveReport(db,ids.INSPECTOR,project.id,null,{...input,activities}));
  const narrative={...emptyReport(project.startDate),activities:[{...input.activities[0],id:randomUUID(),workItemId:null,quantity:null}]};
  const created=await saveReport(db,ids.INSPECTOR,project.id,null,narrative);await submitReport(db,ids.INSPECTOR,project.id,created.id,{editVersion:1});
  const context=await planContext(db,ids.TEAM_LEADER,project.id),date=project.today;
  await assert.rejects(saveReport(db,ids.TEAM_LEADER,project.id,null,{...emptyReport(date),activities:[{...input.activities[0],id:randomUUID()}]}),/jadwal/);
  await publishPlan(db,ids.TEAM_LEADER,project.id,{previousVersionId:context.versions[0].id,basisToken:context.basisToken,name:'Perpanjangan',reason:'Waktu pelaksanaan diperpanjang',description:'',startDate:project.startDate,endDate:date,effectiveDate:date,granularity:'MONTHLY',items:[{workItemId:item.id,targets:['20','30','50']}]});
  const late=await saveReport(db,ids.TEAM_LEADER,project.id,null,{...emptyReport(date),activities:[{...input.activities[0],id:randomUUID()}]});assert.equal((await getReport(db,ids.TEAM_LEADER,project.id,late.id)).calendar.remainingDays,0);
  await assert.rejects(saveReport(db,ids.TEAM_LEADER,project.id,null,{...emptyReport(dateAt(dayIndex(date)+1)),activities:[{...input.activities[0],id:randomUUID()}]}),/hari ini/);
});
test('Inspector lain, Owner, akun tanpa penugasan dan pembaca tidak dapat membocorkan atau mengubah draf/foto',async t=>{
  const {db,directory,ids,project,other,input,png,request}=await setup(t),created=await saveReport(db,ids.INSPECTOR,project.id,null,input),url=`/api/projects/${project.id}/reports/${created.id}`;
  const photo=await uploadPhoto(db,directory,ids.INSPECTOR,project.id,created.id,photoInput(input,png));
  assert.equal((await request(null,'GET',url)).statusCode,401);
  for(const role of ['OWNER','OTHER_INSPECTOR']){assert.equal((await request(role,'GET',url)).statusCode,404);assert.equal((await request(role,'GET',`${url}/photos/${photo.id}/file`)).statusCode,404);assert.equal((await request(role,'GET',`/api/projects/${project.id}/reports`)).json().reports.length,0);}
  for(const role of ['ADMINISTRATOR','ENGINEER','OWNER','OTHER_INSPECTOR','TEAM_LEADER'])assert.ok([403,404].includes((await request(role,'PATCH',url,{...input,editVersion:2})).statusCode));
  assert.equal((await request('INSPECTOR','GET',`/api/projects/${other.id}/reports/${created.id}`)).statusCode,404);
  assert.equal((await request('INSPECTOR','POST',`${url}/photos`,{...photoInput(input,png,2),activityId:randomUUID()})).statusCode,400);
  assert.equal((await workPhotos(db,ids.OWNER,project.id,input.activities[0].workItemId!)).length,0);
  assert.equal((await request('INSPECTOR','GET',`/storage/uploads/${photo.id}.jpg`)).statusCode,404);
  assert.equal((await request('INSPECTOR','PATCH',url,{...input,editVersion:2,status:'APPROVED'})).statusCode,400);
  await submitReport(db,ids.INSPECTOR,project.id,created.id,{editVersion:2});
  await reviewReport(db,ids.TEAM_LEADER,project.id,created.id,{editVersion:3,kind:'APPROVE',note:''});
  assert.equal((await request('OWNER','GET',`${url}/photos/${photo.id}/file`)).statusCode,200);
  assert.equal((await workPhotos(db,ids.OWNER,project.id,input.activities[0].workItemId!)).length,1);
});
test('kirim mewajibkan foto, status terkunci, konflik edit/duplikasi dan pengiriman ganda hanya satu efek',async t=>{
  const {db,directory,ids,project,input,png}=await setup(t),created=await saveReport(db,ids.INSPECTOR,project.id,null,input);
  await assert.rejects(submitReport(db,ids.INSPECTOR,project.id,created.id,{editVersion:1}),/foto/);
  await assert.rejects(saveReport(db,ids.INSPECTOR,project.id,null,{...input,activities:[{...input.activities[0],id:randomUUID()}]}),/sudah ada/);
  const edits=await Promise.allSettled([saveReport(db,ids.INSPECTOR,project.id,created.id,{...input,editVersion:1,generalNotes:'A'}),saveReport(db,ids.INSPECTOR,project.id,created.id,{...input,editVersion:1,generalNotes:'B'})]);assert.equal(edits.filter(r=>r.status==='fulfilled').length,1);
  const uploaded=await uploadPhoto(db,directory,ids.INSPECTOR,project.id,created.id,photoInput(input,png,2));
  const submissions=await Promise.allSettled([submitReport(db,ids.INSPECTOR,project.id,created.id,{editVersion:3}),submitReport(db,ids.INSPECTOR,project.id,created.id,{editVersion:3})]);assert.equal(submissions.filter(r=>r.status==='fulfilled').length,1);
  const report=await getReport(db,ids.INSPECTOR,project.id,created.id);assert.equal(report.status,'SUBMITTED');assert.equal(report.canEdit,false);
  await assert.rejects(saveReport(db,ids.INSPECTOR,project.id,created.id,inputOf(report)),/sudah dikirim/);
  await assert.rejects(uploadPhoto(db,directory,ids.INSPECTOR,project.id,created.id,photoInput(input,png,4)),/sudah dikirim/);
  await assert.rejects(deletePhoto(db,directory,ids.INSPECTOR,project.id,created.id,uploaded.id,{editVersion:4}),/sudah dikirim/);
  await assert.rejects(deleteReport(db,directory,ids.INSPECTOR,project.id,created.id,{editVersion:4}),/sudah dikirim/);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_events WHERE action='SUBMIT_REPORT'")).rows[0].n,1);
});
test('foto invalid, batas ukuran/piksel, rollback file, referensi foto, hapus dan arsip',async t=>{
  const {db,directory,ids,project,input,png}=await setup(t),created=await saveReport(db,ids.INSPECTOR,project.id,null,input);
  for(const data of [Buffer.from('<svg onload="alert(1)"/>'),Buffer.from([255,216,255,0]),png.subarray(0,20)])await assert.rejects(normalizePhoto(data.toString('base64'),data[0]===255?'image/jpeg':'image/png'));
  await assert.rejects(normalizePhoto(png.toString('base64'),'image/jpeg'));
  await assert.rejects(normalizePhoto(Buffer.alloc(5*1024*1024+1).toString('base64'),'image/png'));
  const huge=await sharp({create:{width:5000,height:5000,channels:3,background:'#ffffff'}}).png().toBuffer();await assert.rejects(normalizePhoto(huge.toString('base64'),'image/png'),/piksel/);
  await db.query("CREATE FUNCTION fail_photo_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced photo failure'; END; $$; CREATE TRIGGER force_photo_failure BEFORE INSERT ON daily_report_photos FOR EACH ROW EXECUTE FUNCTION fail_photo_insert()");
  await assert.rejects(uploadPhoto(db,directory,ids.INSPECTOR,project.id,created.id,photoInput(input,png)),/forced photo/);assert.deepEqual(await readdir(directory),[]);
  assert.equal((await getReport(db,ids.INSPECTOR,project.id,created.id)).editVersion,1);await db.query('DROP TRIGGER force_photo_failure ON daily_report_photos');
  const photo=await uploadPhoto(db,directory,ids.INSPECTOR,project.id,created.id,photoInput(input,png));
  await assert.rejects(saveReport(db,ids.INSPECTOR,project.id,created.id,{...input,editVersion:2,activities:[{...input.activities[0],id:randomUUID()}]}),/foto terkait/);
  await deletePhoto(db,directory,ids.INSPECTOR,project.id,created.id,photo.id,{editVersion:2});assert.deepEqual(await readdir(directory),[]);
  await uploadPhoto(db,directory,ids.INSPECTOR,project.id,created.id,photoInput(input,png,3));
  await deleteReport(db,directory,ids.INSPECTOR,project.id,created.id,{editVersion:4});assert.deepEqual(await readdir(directory),[]);assert.equal((await listReports(db,ids.INSPECTOR,project.id)).reports.length,0);
  const replacement=await saveReport(db,ids.INSPECTOR,project.id,null,input);assert.equal((await getReport(db,ids.INSPECTOR,project.id,replacement.id)).reportNumber,'LH-00002');
  await archiveProject(db,ids.TEAM_LEADER,project.id,{confirm:true,reason:'Selesai uji'});await assert.rejects(uploadPhoto(db,directory,ids.INSPECTOR,project.id,replacement.id,photoInput(input,png)),/arsip/);
});

test('T07 sumber sah, persetujuan idempoten, koreksi 250 menjadi 200 dan jejak lintas role',async t=>{
  const f=await setup(t,false,true),{db,ids,project,request}=f;
  const read=()=>projectProgress(db,ids.OWNER,project.id,{from:project.startDate,cutoff:project.endDate});
  const draft=await saveReport(db,ids.INSPECTOR,project.id,null,{...emptyReport(dateAt(dayIndex(project.startDate)+1)),activities:[{...f.input.activities[0],id:randomUUID(),quantity:'10'}]});
  const id=await submitted(f,'INSPECTOR','250');
  assert.equal((await read()).total.actual.cumulative,'0.000000');
  const decisions=await Promise.allSettled([1,2].map(()=>reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:3,kind:'APPROVE',note:''})));
  assert.equal(decisions.filter(r=>r.status==='fulfilled').length,1);
  let result=await read();assert.equal(result.total.actual.cumulative,'2.500000');assert.equal(result.sources.length,1);
  assert.equal(result.sources[0].reportDate,project.startDate);assert.ok(result.sources[0].approvedAt!>project.endDate);
  assert.equal(result.items.find(i=>i.id===f.item.id)!.actual.cumulative.physical,'25.000000');
  const version=result.sourceVersion;
  const correction=await correctReport(db,f.directory,ids.INSPECTOR,project.id,id,{editVersion:4,reason:'Pengukuran ulang'});
  let report=await getReport(db,ids.INSPECTOR,project.id,correction.id);
  await saveReport(db,ids.INSPECTOR,project.id,correction.id,{...inputOf(report),activities:inputOf(report).activities.map(a=>({...a,quantity:'200'}))});
  await submitReport(db,ids.INSPECTOR,project.id,correction.id,{editVersion:2});
  assert.equal((await read()).sourceVersion,version);
  await reviewReport(db,ids.TEAM_LEADER,project.id,correction.id,{editVersion:3,kind:'APPROVE',note:''});
  result=await read();assert.equal(result.total.actual.cumulative,'2.000000');assert.equal(result.sourceCount,1);assert.equal(result.sources[0].revision,2);assert.notEqual(result.sourceVersion,version);
  assert.equal((await getReport(db,ids.OWNER,project.id,id)).activities[0].quantity,'250.000000');
  const url=`/api/projects/${project.id}/progress`;
  for(const role of ['ADMINISTRATOR','TEAM_LEADER','ENGINEER','INSPECTOR','OWNER']){
    const response=await request(role,'GET',url);assert.equal(response.statusCode,200);assert.equal(response.json().total.actual.cumulative,'2.000000');
  }
  const restricted=await projectProgress(db,ids.OTHER_INSPECTOR,project.id);assert.equal(restricted.traceRestricted,true);assert.equal(restricted.sources.length,0);assert.equal(restricted.total.actual.cumulative,'2.000000');
  assert.equal((await request(null,'GET',url)).statusCode,401);
  assert.equal((await request('OWNER','GET',`/api/projects/${f.other.id}/progress`)).statusCode,404);
  for(const query of ['from=2026-07-24&cutoff=2026-07-23','cutoff=2026-02-29',`planVersionId=${randomUUID()}`,`workItemId=${randomUUID()}`])assert.ok([400,404].includes((await request('OWNER','GET',`${url}?${query}`)).statusCode));
  const filtered=await projectProgress(db,ids.OWNER,project.id,{workItemId:f.item.id});assert.equal(filtered.items.length,1);assert.deepEqual(filtered.total.actual,result.total.actual);
  const fresh=openDatabase(readConfig().databaseUrl,f.schema);try{assert.equal((await projectProgress(fresh,ids.OWNER,project.id)).total.actual.cumulative,'2.000000');}finally{await fresh.end();}
  assert.equal((await getReport(db,ids.INSPECTOR,project.id,draft.id)).status,'DRAFT');
});

test('T07 revisi rencana menjaga aktual, cutoff kegiatan, tanpa baseline, arsip tetap terbaca',async t=>{
  const f=await setup(t),{db,ids,project}=f,id=await submitted(f,'INSPECTOR','250');
  await reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:3,kind:'APPROVE',note:''});
  const query={from:project.startDate,cutoff:project.today};
  const before=await projectProgress(db,ids.OWNER,project.id,query);
  const context=await planContext(db,ids.TEAM_LEADER,project.id);
  const end=dateAt(dayIndex(project.today)+7),count=periods(project.startDate,end,'WEEKLY',newWeekConvention).length;
  await publishPlan(db,ids.TEAM_LEADER,project.id,{previousVersionId:context.versions.at(-1)!.id,basisToken:context.basisToken,name:'Revisi',reason:'Penyesuaian jadwal',description:'',startDate:project.startDate,endDate:end,effectiveDate:project.today,granularity:'WEEKLY',items:[{workItemId:f.item.id,targets:Array.from({length:count},(_,i)=>i===count-1?'100':'0')}]});
  const after=await projectProgress(db,ids.OWNER,project.id,query);
  assert.deepEqual(before.total.actual,after.total.actual);assert.deepEqual(before.items.map(i=>i.actual),after.items.map(i=>i.actual));assert.deepEqual(before.sources,after.sources);assert.equal(before.sourceVersion,after.sourceVersion);assert.notDeepEqual(before.total.target,after.total.target);
  const explicit=await projectProgress(db,ids.OWNER,project.id,{...query,planVersionId:before.selectedPlanId!});assert.deepEqual(explicit.total, before.total);
  const baselineReport=await periodReport(db,ids.OWNER,project.id,{type:'MONTHLY',period:'1',planVersionId:before.selectedPlanId!});
  const revisedReport=await periodReport(db,ids.OWNER,project.id,{type:'MONTHLY',period:'1',planVersionId:after.selectedPlanId!});
  assert.deepEqual(baselineReport.period,revisedReport.period);assert.deepEqual(baselineReport.progress.total.actual,revisedReport.progress.total.actual);assert.deepEqual(baselineReport.reports,revisedReport.reports);
  const early=await projectProgress(db,ids.OWNER,project.id,{cutoff:dateAt(dayIndex(project.startDate)-1)});assert.equal(early.state,'NO_EFFECTIVE_PLAN');assert.equal(early.total.actual.cumulative,'0.000000');
  const next=await projectProgress(db,ids.OWNER,project.id,{from:dateAt(dayIndex(project.startDate)+1),cutoff:project.endDate});assert.equal(next.total.actual.previous,'25.000000');assert.equal(next.total.actual.current,'0.000000');
  assert.equal((await projectProgress(db,ids.ADMINISTRATOR,f.other.id)).state,'NO_BASELINE');
  await archiveProject(db,ids.TEAM_LEADER,project.id,{confirm:true,reason:'Uji baca arsip'});assert.equal((await projectProgress(db,ids.OWNER,project.id)).total.actual.cumulative,'25.000000');
});

test('T07 dua approval bersamaan pada item sama menjaga batas kontrak dan sumber tunggal',async t=>{
  const f=await setup(t),{db,ids,project}=f;
  const first=await submitted(f,'INSPECTOR','600'),second=await submitted(f,'OTHER_INSPECTOR','600');
  const results=await Promise.allSettled([first,second].map(id=>reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:3,kind:'APPROVE',note:''})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const result=await projectProgress(db,ids.OWNER,project.id);assert.equal(result.total.actual.cumulative,'60.000000');assert.equal(result.sourceCount,1);
  const pending=[first,second].find(id=>id!==result.sources[0].reportId)!;
  await reviewReport(db,ids.TEAM_LEADER,project.id,pending,{editVersion:3,kind:'REQUEST_CHANGES',note:'Kurangi volume sesuai sisa kontrak'});
  assert.equal((await projectProgress(db,ids.OWNER,project.id)).sourceVersion,result.sourceVersion);
});

test('T08 minggu/bulan lintas batas, bulan parsial, periode kosong dan angka sama dengan progress',async t=>{
 const f=await setup(t,false,false,'2026-08-18'),{db,ids,project}=f;
 for(const [date,quantity] of [['2026-07-19','100'],['2026-07-20','150'],['2026-08-15','100'],['2026-08-16','50']]){
  const input={...emptyReport(date),activities:[{...f.input.activities[0],id:randomUUID(),quantity}]};
  const {id}=await saveReport(db,ids.INSPECTOR,project.id,null,input);
  await uploadPhoto(db,f.directory,ids.INSPECTOR,project.id,id,photoInput(input,f.png));
  await submitReport(db,ids.INSPECTOR,project.id,id,{editVersion:2});
  await reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:3,kind:'APPROVE',note:''});
 }
 const first=await periodReport(db,ids.OWNER,project.id,{type:'WEEKLY',period:'1'});
 assert.equal(first.period.end,'2026-07-19');assert.equal(first.progress.total.actual.current,'10.000000');
 const second=await periodReport(db,ids.OWNER,project.id,{type:'WEEKLY',period:'2'});
 assert.deepEqual(second.progress.total.actual,{previous:'10.000000',current:'15.000000',cumulative:'25.000000'});
 const empty=await periodReport(db,ids.OWNER,project.id,{type:'WEEKLY',period:'3'});assert.equal(empty.progress.total.actual.current,'0.000000');assert.equal(empty.reports.length,0);assert.equal(empty.progress.total.actual.cumulative,'25.000000');
 const month=await periodReport(db,ids.OWNER,project.id,{type:'MONTHLY',period:'1'});assert.equal(month.period.end,'2026-08-15');assert.equal(month.progress.total.actual.current,'35.000000');
 const partial=await periodReport(db,ids.OWNER,project.id,{type:'MONTHLY',period:'2'});assert.equal(partial.period.days,3);assert.deepEqual(partial.progress.total.actual,{previous:'35.000000',current:'5.000000',cumulative:'40.000000'});
 const direct=await projectProgress(db,ids.OWNER,project.id,{from:partial.period.start,cutoff:partial.period.end});assert.deepEqual(partial.progress.total,direct.total);assert.deepEqual(partial.progress.items,direct.items);
 assert.equal(partial.identity.day,34);assert.equal(partial.identity.remainingDays,0);assert.equal(partial.statuses[f.item.id],'Sedang Dikerjakan');
 assert.equal(partial.identity.contractNumber,project.contractNumber);assert.equal(partial.identity.currentContractValue,project.currentContractValue);
 const none=await periodReport(db,ids.ADMINISTRATOR,f.other.id);assert.equal(none.progress.state,'NO_BASELINE');assert.equal(none.progress.total.actual.cumulative,null);
 const long=await createProject(db,ids.ADMINISTRATOR,projectInput({projectCode:'LONG-REPORT',endDate:'2040-01-01'}));
 await assert.rejects(periodReport(db,ids.ADMINISTRATOR,long.id),/3.660/);
});

test('rekap historis memakai aturan minggu versi lama dan rekap baru memakai Senin-Minggu',async t=>{
 const f=await setup(t,true,false,'2026-10-14'),{db,ids,project,item}=f;
 // Rencana Awal dibuat pada schema historis; migration mengisinya sebagai PROJECT_START.
 assert.equal(await migrate(db),4);
 const initial=await planContext(db,ids.TEAM_LEADER,project.id),baseline=initial.versions[0];
 assert.equal(baseline.weekConvention,'PROJECT_START');
 const context=await planContext(db,ids.TEAM_LEADER,project.id);
 const newWeeks=periods(project.startDate,project.endDate,'WEEKLY',newWeekConvention);
 await publishPlan(db,ids.TEAM_LEADER,project.id,{previousVersionId:baseline.id,basisToken:context.basisToken,
   name:'Koreksi jadwal',reason:'Koreksi minggu',description:'',startDate:project.startDate,endDate:project.endDate,
   effectiveDate:project.today,granularity:'WEEKLY',items:[{workItemId:item.id,targets:newWeeks.map((_,index)=>index===0?'100':'0')}]});
 const versions=(await planContext(db,ids.TEAM_LEADER,project.id)).versions;
 const historic=await periodReport(db,ids.OWNER,project.id,{type:'WEEKLY',period:'1'});
 assert.equal(historic.period.end,'2026-07-22');
 assert.equal(historic.progress.selectedPlanId,baseline.id);
 const firstNew=await periodReport(db,ids.OWNER,project.id,{type:'WEEKLY',period:'1',planVersionId:versions[1].id});
 assert.equal(firstNew.period.end,'2026-07-19');
 const currentWeek=newWeeks.find(part=>part.start<=project.today&&part.end>=project.today)!;
 const current=await periodReport(db,ids.OWNER,project.id,{type:'WEEKLY',period:String(currentWeek.number)});
 assert.equal(current.period.start,currentWeek.start);
 assert.equal(current.progress.selectedPlanId,versions[1].id);
 assert.equal((await projectProgress(db,ids.OWNER,project.id,{cutoff:'2026-10-07'})).selectedPlanId,baseline.id);
});

test('T08 rincian hanya sumber sah, koreksi mengganti rekap, otorisasi dan validasi periode',async t=>{
 const f=await setup(t),{db,ids,project,request}=f,id=await submitted(f,'INSPECTOR','250');
 const read=()=>periodReport(db,ids.OWNER,project.id,{type:'MONTHLY',period:'1'});
 assert.equal((await read()).reports.length,0);
 await reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:3,kind:'APPROVE',note:''});
 let result=await read();assert.equal(result.reports.length,1);assert.equal(result.reports[0].workforce[0].quantity,3);assert.equal(result.reports[0].materials[0].type,'DITOLAK');assert.equal(result.reports[0].problems[0].problem,f.input.problems[0].problem);
 const correction=await correctReport(db,f.directory,ids.INSPECTOR,project.id,id,{editVersion:4,reason:'Koreksi hasil pengukuran'});
 const revised=await getReport(db,ids.INSPECTOR,project.id,correction.id);
 await saveReport(db,ids.INSPECTOR,project.id,correction.id,{...inputOf(revised),activities:inputOf(revised).activities.map(a=>({...a,quantity:'200'})),workforce:[]});
 assert.equal((await read()).reports[0].id,id);
 await submitReport(db,ids.INSPECTOR,project.id,correction.id,{editVersion:2});await reviewReport(db,ids.TEAM_LEADER,project.id,correction.id,{editVersion:3,kind:'APPROVE',note:''});
 result=await read();assert.equal(result.progress.total.actual.cumulative,'20.000000');assert.equal(result.reports.length,1);assert.equal(result.reports[0].revision,2);assert.equal(result.reports[0].workforce.length,0);
 const restricted=await periodReport(db,ids.OTHER_INSPECTOR,project.id,{type:'MONTHLY',period:'1'});assert.equal(restricted.detailsRestricted,true);assert.equal(restricted.reports.length,0);assert.deepEqual(restricted.progress.total,result.progress.total);
 const root=`/api/projects/${project.id}/period-reports`;
 for(const role of ['ADMINISTRATOR','TEAM_LEADER','ENGINEER','OWNER','INSPECTOR'])assert.equal((await request(role,'GET',root)).statusCode,200);
 assert.equal((await request(null,'GET',root)).statusCode,401);
 assert.equal((await request('OWNER','GET',`/api/projects/${f.other.id}/period-reports`)).statusCode,404);
 for(const q of ['period=0','period=-1','period=1.5','period=999','type=DAILY','extra=x'])assert.equal((await request('OWNER','GET',`${root}?${q}`)).statusCode,400);
 assert.equal((await request('OWNER','GET',`${root}?planVersionId=${randomUUID()}`)).statusCode,404);
 const narrative=await saveReport(db,ids.OTHER_INSPECTOR,project.id,null,{...emptyReport(project.startDate),generalNotes:'Catatan tanpa volume',activities:[{id:randomUUID(),workItemId:null,description:'Koordinasi lapangan',location:'Kantor',quantity:null,notes:''}]});
 await submitReport(db,ids.OTHER_INSPECTOR,project.id,narrative.id,{editVersion:1});await reviewReport(db,ids.TEAM_LEADER,project.id,narrative.id,{editVersion:2,kind:'APPROVE',note:''});
 const withNarrative=await read();assert.equal(withNarrative.reports.length,2);assert.equal(withNarrative.progress.total.actual.cumulative,'20.000000');assert.ok(withNarrative.reports.some(r=>r.notes==='Catatan tanpa volume'));
 await archiveProject(db,ids.TEAM_LEADER,project.id,{confirm:true,reason:'Uji laporan arsip'});assert.equal((await read()).progress.total.actual.cumulative,'20.000000');
});

test('T09 ringkasan lima role, galeri/filter/riwayat tidak bocor dan akses dicabut',async t=>{
 const f=await setup(t),{db,ids,project,request}=f,id=await submitted(f);
 const root=`/api/projects/${project.id}`;
 for(const role of ['ADMINISTRATOR','TEAM_LEADER','ENGINEER','OWNER','INSPECTOR']){
  assert.equal((await request(role,'GET','/api/dashboard')).statusCode,200);
  assert.equal((await request(role,'GET',`${root}/monitoring`)).statusCode,200);
  const d=await dashboard(db,ids[role]);assert.equal(d.users===null,role!=='ADMINISTRATOR');assert.equal(d.counts.pending,role==='OWNER'?0:1);
  assert.equal(d.projectSummaries.length,d.projects.length);const summary=d.projectSummaries.find(value=>value.projectId===project.id)!;assert.equal(summary.progressState,'READY');
  assert.equal(summary.pendingReviews,role==='OWNER'?0:1);assert.equal(d.counts.inProgress+d.counts.delayed,d.counts.active);
 }
 assert.equal((await projectGallery(db,ids.OWNER,project.id)).photos.length,0);
 assert.ok(!(await projectHistory(db,ids.OWNER,project.id)).entries.some(e=>e.url?.includes(id)));
 assert.equal((await projectMonitoring(db,ids.OWNER,project.id)).problems.length,0);
 const own=(await projectGallery(db,ids.INSPECTOR,project.id)).photos;assert.equal(own.length,1);
 assert.equal((await projectGallery(db,ids.OTHER_INSPECTOR,project.id)).photos.length,0);
 assert.equal((await projectGallery(db,ids.INSPECTOR,project.id,{from:project.startDate,to:project.startDate,workItemId:f.item.id,reportId:id,uploadedBy:ids.INSPECTOR})).photos.length,1);
 assert.equal((await projectGallery(db,ids.INSPECTOR,project.id,{from:dateAt(dayIndex(project.startDate)+1)})).photos.length,0);
 await reviewReport(db,ids.ENGINEER,project.id,id,{editVersion:3,kind:'TECHNICAL_NOTE',note:'Catatan teknik rahasia sebelum sah'});
 assert.equal((await projectMonitoring(db,ids.OWNER,project.id)).notes.length,0);
 assert.equal((await projectMonitoring(db,ids.ENGINEER,project.id)).notes.length,1);
 await reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:4,kind:'APPROVE',note:'Disetujui untuk monitoring'});
 assert.equal((await projectGallery(db,ids.OWNER,project.id)).photos.length,1);
 assert.equal((await projectHistory(db,ids.OWNER,project.id)).entries.filter(e=>e.action==='Laporan disetujui').length,1);
 const correction=await correctReport(db,f.directory,ids.INSPECTOR,project.id,id,{editVersion:5,reason:'Alasan pending tersembunyi'});
 assert.equal((await projectGallery(db,ids.OWNER,project.id)).photos.length,1);
 assert.ok(!JSON.stringify(await projectHistory(db,ids.OWNER,project.id)).includes('Alasan pending tersembunyi'));
 assert.ok(!JSON.stringify(await projectMonitoring(db,ids.OWNER,project.id)).includes(correction.id));
 for(const path of ['monitoring','gallery','history']){
  assert.equal((await request('OWNER','GET',`/api/projects/${f.other.id}/${path}`)).statusCode,404);
  assert.equal((await request(null,'GET',`${root}/${path}`)).statusCode,401);
 }
 assert.equal((await request('OWNER','GET',`${root}/gallery?from=2026-07-23&to=2026-07-16`)).statusCode,400);
 assert.equal((await request('OWNER','GET',`${root}/monitoring?planVersionId=${randomUUID()}`)).statusCode,404);
 await db.query("UPDATE project_members SET is_active=false WHERE project_id=$1 AND user_id=$2",[project.id,ids.OWNER]);
 assert.equal((await request('OWNER','GET',`${root}/gallery`)).statusCode,404);
 assert.equal((await dashboard(db,ids.OWNER)).projects.length,0);
});

test('T09 grafik sama dengan progress, rencana pembanding, status dan sumber sah',async t=>{
 const f=await setup(t),{db,ids,project}=f,id=await submitted(f,'INSPECTOR','250');
 await reviewReport(db,ids.TEAM_LEADER,project.id,id,{editVersion:3,kind:'APPROVE',note:''});
 const before=await projectMonitoring(db,ids.OWNER,project.id,{cutoff:project.endDate});
 for(const point of before.curve.points){
  const p=await projectProgress(db,ids.OWNER,project.id,{cutoff:point.date});
  assert.equal(point.actual,p.total.actual.cumulative);
 }
 assert.equal(before.progress.total.actual.cumulative,'25.000000');assert.deepEqual(before.ongoing,[f.item.id]);
 const context=await planContext(db,ids.TEAM_LEADER,project.id),end=dateAt(dayIndex(project.today)+7),parts=periods(project.startDate,end,'WEEKLY',newWeekConvention);
 await publishPlan(db,ids.TEAM_LEADER,project.id,{previousVersionId:context.versions.at(-1)!.id,basisToken:context.basisToken,name:'Revisi grafik',reason:'Perpanjangan jadwal',description:'',startDate:project.startDate,endDate:end,effectiveDate:project.today,granularity:'WEEKLY',items:[{workItemId:f.item.id,targets:parts.map((_,i)=>i===parts.length-1?'100':'0')}]});
 const latest=await projectMonitoring(db,ids.OWNER,project.id),original=await projectMonitoring(db,ids.OWNER,project.id,{planVersionId:context.versions[0].id});
 assert.deepEqual(latest.curve.points.map(p=>p.actual),original.curve.points.map(p=>p.actual));
 assert.notDeepEqual(latest.curve.points.map(p=>p.latest),original.curve.points.map(p=>p.latest));
 assert.equal(latest.curve.points.at(-1)!.actual,null);assert.equal(latest.curve.points.at(-1)!.latest,'100.000000');
 assert.equal((await getProject(db,ids.OWNER,project.id)).automaticStatus,'IN_PROGRESS');
 const correction=await correctReport(db,f.directory,ids.INSPECTOR,project.id,id,{editVersion:4,reason:'Seluruh volume telah selesai'});
 const r=await getReport(db,ids.INSPECTOR,project.id,correction.id);
 await saveReport(db,ids.INSPECTOR,project.id,correction.id,{...inputOf(r),activities:inputOf(r).activities.map(a=>({...a,quantity:'1000'}))});
 await submitReport(db,ids.INSPECTOR,project.id,correction.id,{editVersion:2});await reviewReport(db,ids.TEAM_LEADER,project.id,correction.id,{editVersion:3,kind:'APPROVE',note:''});
 assert.equal((await getProject(db,ids.OWNER,project.id)).automaticStatus,'COMPLETED');
 assert.equal((await dashboard(db,ids.TEAM_LEADER)).counts.completed,1);
 await changeProjectStatus(db,ids.TEAM_LEADER,project.id,{statusOverride:'CLOSED',reason:'Ditutup secara resmi'});
 const closed=await getProject(db,ids.OWNER,project.id);assert.equal(closed.status,'CLOSED');assert.equal(closed.automaticStatus,'COMPLETED');
 const empty=await projectMonitoring(db,ids.ADMINISTRATOR,f.other.id);assert.equal(empty.curve.points.length,0);assert.equal(empty.progress.total.actual.cumulative,null);
});
