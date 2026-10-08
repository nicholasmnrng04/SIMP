import { z } from 'zod';
import { dateSchema } from './projects.js';
import { displayDecimal } from './work-items.js';
import type { PrintPage } from './print-layout.js';
export const exportKinds = ['DAILY','WEEKLY','MONTHLY','PROGRESS','CURVE','WORKFORCE','MATERIALS','PROBLEMS'] as const;
export const exportLabels: Record<typeof exportKinds[number], string> = { DAILY:'Laporan Harian',WEEKLY:'Laporan Mingguan',MONTHLY:'Laporan Bulanan',PROGRESS:'Rekap Progress',CURVE:'Grafik Rencana dan Aktual',WORKFORCE:'Rekap Tenaga Kerja',MATERIALS:'Rekap Material dan Alat',PROBLEMS:'Rekap Masalah Lapangan' };
export const exportQuery = z.object({ workbookLogos:z.enum(['true','false']).default('true'),kind:z.enum(exportKinds,{error:'Pilih jenis laporan.'}),format:z.enum(['web','pdf','xlsx'],{error:'Pilih format laporan.'}).default('web'),reportId:z.string().uuid('Pilih laporan harian.').optional(),period:z.string().regex(/^[1-9]\d{0,2}$/,'Pilih nomor periode positif.').optional(),from:dateSchema.optional(),cutoff:dateSchema.optional(),planVersionId:z.string().uuid('Pilih versi rencana.').optional() }).strict().superRefine((v,c)=>{
  if(v.kind==='DAILY'&&!v.reportId)c.addIssue({code:'custom',path:['reportId'],message:'Pilih laporan harian.'});
  if(v.from&&v.cutoff&&v.from>v.cutoff)c.addIssue({code:'custom',path:['from'],message:'Awal periode tidak boleh melewati cut-off.'});
  if(['WEEKLY','MONTHLY'].includes(v.kind)&&(v.from||v.cutoff))c.addIssue({code:'custom',message:'Laporan berkala menggunakan nomor periode, bukan rentang bebas.'});
});
export type ExportQuery = z.infer<typeof exportQuery>;
export type ExportCell = string | number | null;
export type ExportTable = { title:string; columns:{label:string;numeric?:boolean}[]; rows:ExportCell[][] };
export type ExportDocument = { kind:ExportQuery['kind']; title:string; projectId:string; generatedAt:string; metadata:[string,string][]; notes:string[]; tables:ExportTable[]; photos:{id:string;reportId:string;url:string;caption:string}[]; layout?:PrintPage[]; chart?:{labels:string[];series:{name:string;values:(string|null)[];color:string}[]} };
export function exportCellText(value:ExportCell,numeric=false){ if(value===null)return '—'; if(!numeric)return String(value);if(typeof value==='number')return value.toLocaleString('id-ID',{maximumFractionDigits:6});const v=String(value);return `${v.startsWith('-')?'-':''}${displayDecimal(v.replace(/^-/,''),6)}`; }
