import type { Pool } from 'pg';
import { transaction } from '../db/database.js';
import { projectActor, requireProject } from './projects.js';
import { progressInTransaction, progressCurveInTransaction } from './progress.js';
import { getReportInTransaction, readPhotoInTransaction } from './reports.js';
import { periodReportInTransaction, approvedPeriodDetails } from './period-reports.js';
import { exportQuery, exportLabels, type ExportDocument, type ExportTable, type ExportCell } from '../../shared/exports.js';
import { centsToMoney, formatRupiah } from '../../shared/projects.js';
import { reportStatuses, type ReportInput } from '../../shared/reports.js';
import { scaled, decimal } from '../../shared/work-items.js';
import type { ProgressResult } from '../../shared/progress.js';
import { workbookLayout } from './workbook-layout.js';
import { workbookSvg } from './workbook-print.js';
import { chartImage } from './export-files.js';
import { daysBetween } from '../../shared/plans.js';

const table = (title:string,labels:string[],rows:ExportCell[][],numbers:number[]=[]):ExportTable => ({title,columns:labels.map((label,i)=>({label,numeric:numbers.includes(i)})),rows});
function progressTables(p:ProgressResult):ExportTable[]{
  return [table('Basis pekerjaan',['Kode','Pekerjaan','Satuan','Volume kontrak','Harga satuan (Rp)','Nilai pekerjaan (Rp)','Bobot (%)','Keterangan'],p.items.map(i=>[i.code,i.name,i.unit,i.kind==='ITEM'?i.contractVolume:null,i.kind==='ITEM'?i.unitPrice:null,i.amount,i.weight,i.notes]),[3,4,5,6]),
    table('Progress pekerjaan',['Kode','Periode','Volume aktual','Fisik aktual (%)','Aktual berbobot (%)','Volume target','Fisik target (%)','Target berbobot (%)','Selisih kumulatif (poin)'],p.items.flatMap(i=>(['previous','current','cumulative'] as const).map((key,index)=>[i.code,['Sebelumnya','Periode ini','Kumulatif'][index],i.actual[key].quantity,i.actual[key].physical,i.actual[key].weighted,i.target[key].quantity,i.target[key].physical,i.target[key].weighted,key==='cumulative'?i.deviation:null])),[2,3,4,5,6,7,8]),
    table('Total proyek',['Periode','Aktual berbobot (%)','Target berbobot (%)','Selisih (poin)'],(['previous','current','cumulative'] as const).map((key,i)=>[['Sebelumnya','Periode ini','Kumulatif'][i],p.total.actual[key],p.total.target[key],key==='cumulative'?p.total.deviation:null]),[1,2,3])];
}
type Detail = {id:string;number:string;revision:number;date:string;notes:string;workforce:ReportInput['workforce'];materials:ReportInput['materials'];problems:ReportInput['problems']};
function workforceTables(reports:Detail[]):ExportTable[]{
  const totals=new Map<string,{category:string;position:string;days:bigint;hours:bigint}>();
  for(const r of reports)for(const w of r.workforce){const key=JSON.stringify([w.category,w.position]);const v=totals.get(key)??{category:w.category,position:w.position,days:0n,hours:0n};v.days+=BigInt(w.quantity);v.hours+=BigInt(w.quantity)*scaled(w.workingHours,2);totals.set(key,v);}
  return [table('Rincian tenaga kerja',['Tanggal','Laporan','Revisi','Kategori','Jabatan','Jumlah pada laporan','Jam per orang','Identitas tercatat','Catatan'],reports.flatMap(r=>r.workforce.map(w=>[r.date,r.number,r.revision,w.category,w.position,w.quantity,w.workingHours,w.identity,w.notes])),[2,5,6]),table('Rekap tenaga kerja',['Kategori','Jabatan','Orang-hari berdasarkan laporan','Orang-jam'],[...totals.values()].map(v=>[v.category,v.position,v.days.toString(),decimal(v.hours,2)]),[2,3])];
}
function materialTables(reports:Detail[]):ExportTable[]{
  const totals=new Map<string,{type:string;name:string;unit:string;quantity:bigint}>();
  for(const r of reports)for(const m of r.materials){const key=JSON.stringify([m.type,m.name,m.unit]);const v=totals.get(key)??{type:m.type,name:m.name,unit:m.unit,quantity:0n};v.quantity+=scaled(m.quantity,6);totals.set(key,v);}
  return [table('Rincian material dan alat',['Tanggal','Laporan','Revisi','Penerimaan','Nama','Jumlah','Satuan','Alasan','Catatan'],reports.flatMap(r=>r.materials.map(m=>[m.date,r.number,r.revision,m.type==='DITERIMA'?'Diterima':'Ditolak',m.name,m.quantity,m.unit,m.reason,m.notes])),[2,5]),table('Rekap material dan alat',['Penerimaan','Nama','Satuan','Jumlah'],[...totals.values()].map(v=>[v.type==='DITERIMA'?'Diterima':'Ditolak',v.name,v.unit,decimal(v.quantity,6)]),[3])];
}
const problemTable=(reports:Detail[])=>table('Masalah lapangan',['Tanggal','Laporan','Revisi','Lokasi','Masalah','Dampak','Penyelesaian','Status','Catatan'],reports.flatMap(r=>r.problems.map(p=>[p.date,r.number,r.revision,p.location,p.problem,p.impact,p.resolution,p.status,p.notes])),[2]);

// One DTO for web, PDF and XLSX. Shared project lock covers sources and optional image reads.
export async function exportDocument(db:Pool,actorId:string,projectId:string,input:unknown,photoDirectory?:string){
  const q=exportQuery.parse(input);
  return transaction(db,async client=>{
    const actor=await projectActor(client,actorId),project=await requireProject(client,actor,projectId);
    const doc:ExportDocument={kind:q.kind,title:exportLabels[q.kind],projectId,generatedAt:new Date().toISOString(),metadata:[['Proyek',project.project_name],['Kegiatan',project.activity_name],['Lokasi',project.location],['Nomor kontrak',project.contract_number],['Tanggal kontrak',project.contract_date],['Nilai kontrak awal (Rp)',formatRupiah(centsToMoney(project.initial_contract_value_cents))],['Nilai kontrak berjalan (Rp)',formatRupiah(centsToMoney(project.current_contract_value_cents))],['Pemberi pekerjaan',project.client_name],['Konsultan',project.consultant_name],['Nama kontraktor',project.contractor_name],['Zona waktu',project.timezone]],notes:['Prototype SIMP. Identitas proyek menampilkan keadaan saat laporan dibuat; basis progress tetap Rencana Awal.'],tables:[],photos:[]};
    doc.metadata.push(['Nama instansi',project.client_agency??''],['Alamat instansi',project.client_agency_address??''],['Tahun anggaran',String(project.fiscal_year??'')],['Durasi pelaksanaan',String(daysBetween(project.start_date,project.end_date)+1)]);
    let details:Detail[]=[];
    if(q.kind==='DAILY'){
      const r=await getReportInTransaction(client,actorId,projectId,q.reportId!);
      doc.metadata.push(['Minggu ke-',String(r.calendar.week??'')],['Bulan ke-',String(r.calendar.month??'')]);
      doc.metadata.push(['Tanggal / cut-off',r.reportDate],['Nomor laporan',r.reportNumber],['Revisi',String(r.revision)],['Status',reportStatuses[r.status]],['Pembuat',r.createdByName],['Versi rencana',r.planName],['ID versi rencana',r.planVersionId],['ID sumber',r.id],['Nomor perubahan',String(r.editVersion)],['Proyek pada laporan',r.projectName],['Kontrak pada laporan',r.contractNumber],['Hari ke-',String(r.calendar.day??'—')],['Sisa hari',String(r.calendar.remainingDays)]);
      doc.notes.push(r.isAuthoritative?'Versi ini merupakan sumber sah yang berlaku.':r.status==='APPROVED'?'Versi ini arsip disetujui yang telah digantikan.':'Laporan ini belum disetujui dan bukan sumber progress resmi.');
      doc.tables.push(table('Kegiatan harian',['Kode','Pekerjaan','Kegiatan','Lokasi','Volume','Satuan','Catatan'],r.activities.map(a=>[a.workCode,a.workName,a.description,a.location,a.quantity,a.unit,a.notes]),[4]),table('Cuaca',['Periode','Kondisi','Mulai','Selesai','Catatan'],r.weather.map(w=>[w.period,w.condition,w.startTime,w.endTime,w.notes])),table('Catatan laporan',['Catatan umum','Alasan koreksi'],[[r.generalNotes,r.correctionReason]]),table('Pemeriksaan',['Pelaku','Waktu','Tindakan','Catatan'],r.reviews.map(v=>[v.actorName,v.createdAt,v.kind==='APPROVE'?'Disetujui':v.kind==='TECHNICAL_NOTE'?'Catatan teknis':'Minta perbaikan',v.note])));
      details=[{...r,number:r.reportNumber,date:r.reportDate,notes:r.generalNotes}];
      doc.photos=r.photos.map(p=>({id:p.id,reportId:r.id,url:p.url,caption:`${p.takenDate} | ${p.caption} | ${p.location}`}));
    }else{
      let p:ProgressResult;
      if(q.kind==='WEEKLY'||q.kind==='MONTHLY'){
        const r=await periodReportInTransaction(client,actorId,projectId,{type:q.kind==='WEEKLY'?'WEEKLY':'MONTHLY',...(q.period?{period:q.period}:{}),...(q.planVersionId?{planVersionId:q.planVersionId}:{})});p=r.progress;details=r.reports;
        doc.metadata.push(['Nomor periode',String(r.period.number)],['Hari periode',String(r.period.days)],['Hari ke-',String(r.identity.day)],['Sisa hari',String(r.identity.remainingDays)]);
        doc.tables.push(table('Keterangan pekerjaan',['Kode','Pekerjaan','Status'],p.items.map(i=>[i.code,i.name,r.statuses[i.id]])));
        if(r.detailsRestricted)doc.notes.push('Rincian sumber dibatasi ke laporan Anda sendiri; total progress tetap seluruh proyek.');
      }else{
        p=await progressInTransaction(client,actorId,projectId,{...(q.from?{from:q.from}:{}),...(q.cutoff?{cutoff:q.cutoff}:{}),...(q.planVersionId?{planVersionId:q.planVersionId}:{})});
        const d=await approvedPeriodDetails(client,actor,projectId,p.from,p.cutoff);details=d.reports;
        if(d.detailsRestricted||p.traceRestricted)doc.notes.push('Rincian sumber dibatasi ke laporan Anda sendiri; total progress tetap seluruh proyek.');
      }
      doc.metadata.push(['Awal periode',p.from],['Cut-off inklusif',p.cutoff],['Versi target',p.plans.find(v=>v.id===p.selectedPlanId)?.name??'Belum tersedia'],['ID versi target',p.selectedPlanId??'—'],['Basis Rencana Awal',p.basisVersionId??'—'],['Sidik sumber progress',p.sourceVersion]);
      doc.notes.push('Hanya revisi sah yang masih berlaku dihitung. Koreksi atau persetujuan terlambat dapat mengubah periode lama.');
      if(p.warning)doc.notes.push(p.warning);
      if(['WEEKLY','MONTHLY','PROGRESS'].includes(q.kind))doc.tables.push(...progressTables(p));
      if(q.kind==='CURVE'){
        const c=await progressCurveInTransaction(client,projectId,p.cutoff,'WEEKLY',q.planVersionId);
        doc.chart={labels:c.points.map(v=>v.date),series:[{name:`Rencana Awal: ${c.baseline??'Belum tersedia'}`,values:c.points.map(v=>v.baseline),color:'#2364aa'},{name:`Rencana pembanding: ${c.comparison??'Belum tersedia'}`,values:c.points.map(v=>v.latest),color:'#9d4d00'},{name:'Progress Aktual',values:c.points.map(v=>v.actual),color:'#006a4e'}]};
        doc.metadata.push(['Pembanding grafik',c.comparison??'Belum tersedia'],['Berlaku pembanding grafik',c.comparisonEffective??'—']);
        doc.notes.push('Grafik memakai seluruh jadwal. Pembanding default adalah versi terakhir terbit; bisa berbeda dari versi efektif kartu. Aktual setelah cut-off kosong.');
        doc.tables.push(table('Data grafik',['Tanggal','Rencana Awal (%)','Rencana pembanding (%)','Aktual (%)'],c.points.map(v=>[v.date,v.baseline,v.latest,v.actual]),[1,2,3]));
      }
      doc.tables.push(table('Sumber progress',['ID kegiatan','ID laporan','Tanggal','Nomor','Revisi','Volume','Waktu persetujuan'],p.sources.map(s=>[s.activityId,s.reportId,s.reportDate,s.reportNumber,s.revision,s.quantity,s.approvedAt]),[4,5]));
    }
    if(['DAILY','WEEKLY','MONTHLY','WORKFORCE'].includes(q.kind)){doc.tables.push(...workforceTables(details));doc.notes.push('Orang-hari adalah penjumlahan jumlah orang per laporan harian; orang-jam = jumlah orang × jam kerja. Ini bukan jumlah individu unik. Orang yang dicatat pada beberapa laporan bisa dihitung berulang.');}
    if(['DAILY','WEEKLY','MONTHLY','MATERIALS'].includes(q.kind))doc.tables.push(...materialTables(details));
    if(['DAILY','WEEKLY','MONTHLY','PROBLEMS'].includes(q.kind)){doc.tables.push(problemTable(details));doc.notes.push('Masalah adalah catatan per laporan, bukan daftar masalah unik yang sudah dideduplikasi.');}
    doc.tables.push(table('Laporan sumber',['ID','Nomor','Revisi','Tanggal','Catatan'],details.map(r=>[r.id,r.number,r.revision,r.date,r.notes]),[2]));
    doc.metadata.push(['Dibuat pada (UTC)',doc.generatedAt]);
    doc.notes.push('Excel menyimpan angka numerik; angka sangat besar mengikuti batas presisi Excel. Lembar Nilai Eksak menyimpan teks angka sumber tanpa pembulatan.');
    doc.notes.push('Formulir mengikuti layout workbook contoh. PPN/pembulatan dan identitas pengesahan yang belum tersedia tidak diisi dengan data contoh. Teks panjang dilanjutkan dalam rincian lampiran.');
    doc.layout=workbookLayout(doc);
    if(q.workbookLogos==='false')for(const page of doc.layout)page.artwork=[];
    if(q.workbookLogos==='true')doc.notes.push('Logo mengikuti workbook contoh. Nonaktifkan pilihan logo bila instansi atau perusahaan proyek berbeda.');
    const chart=doc.chart?(await chartImage(doc.chart)).toString('base64'):undefined;
    for(const page of doc.layout){if(page.chart)page.chartImage=chart;page.svg=workbookSvg(page);}
    const images=new Map<string,Buffer>();
    if(q.format!=='web'&&photoDirectory)for(const photo of doc.photos)images.set(photo.id,await readPhotoInTransaction(client,photoDirectory,actorId,projectId,photo.reportId,photo.id));
    return {document:doc,images};
  });
}
