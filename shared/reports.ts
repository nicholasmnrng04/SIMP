import { z } from 'zod';
import { dateSchema } from './projects.js';
import type { WorkItemRecord } from './work-items.js';
import type { position } from './plans.js';

const text = (max = 2000) => z.string().trim().max(max, `Maksimal ${max} karakter.`);
const required = (label: string) => text().min(1, `${label} wajib diisi.`);
const quantity = z.string().regex(/^\d{1,12}(\.\d{1,6})?$/, 'Jumlah harus nonnegatif, maksimal enam desimal.');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Jam harus dalam format HH:MM.');
export const reportStatuses = { DRAFT: 'Belum Dikirim', SUBMITTED: 'Menunggu Pemeriksaan', NEEDS_REVISION: 'Perlu Diperbaiki', APPROVED: 'Sudah Disetujui' } as const;
export const reportListQuery = z.object({from:dateSchema.optional(),to:dateSchema.optional(),week:z.string().regex(/^[1-9]\d{0,2}$/,'Minggu harus angka positif.').optional(),month:z.string().regex(/^[1-9]\d{0,2}$/,'Bulan harus angka positif.').optional(),status:z.enum(['DRAFT','SUBMITTED','NEEDS_REVISION','APPROVED']).optional(),createdBy:z.string().uuid('Pembuat tidak valid.').optional()}).strict().refine(v=>!v.from||!v.to||v.from<=v.to,'Rentang tanggal tidak valid.');
export const workerPositions = ['Manajemen Proyek','Manager Lapangan','Staff Administrasi','Drafter','Surveyor','Operator','Pelaksana','Mandor','Tukang','Pekerja','Flagman'] as const;
export const activitySchema = z.object({ id: z.string().uuid('Identitas kegiatan tidak valid.'), workItemId: z.string().min(1).nullable(), description: required('Uraian kegiatan'), location: text(500), quantity: quantity.nullable(), notes: text() }).strict();
const worker = z.object({ category: z.enum(['Manajemen','Lapangan']), position: z.enum(workerPositions), quantity: z.number().int().min(0, 'Jumlah tenaga kerja tidak boleh negatif.').max(10000, 'Maksimal 10.000 orang per baris.'), identity: text(500), workingHours: z.string().regex(/^(\d{1,2})(\.\d{1,2})?$/, 'Jam kerja harus 0–24, maksimal dua desimal.').refine(v => Number(v) <= 24, 'Jam kerja maksimal 24.'), notes: text() }).strict().refine(v => (workerPositions.indexOf(v.position) < 4 ? 'Manajemen' : 'Lapangan') === v.category, 'Kategori tidak sesuai jenis tenaga kerja.');
const weather = z.object({ period: z.enum(['PAGI','SIANG','SORE','MALAM']), condition: z.enum(['BAIK','GERIMIS','HUJAN']), startTime: time, endTime: time, notes: text() }).strict().refine(v => v.endTime > v.startTime, 'Jam selesai cuaca harus setelah jam mulai pada tanggal yang sama.');
const material = z.object({ type: z.enum(['DITERIMA','DITOLAK']), name: required('Nama material/alat'), quantity, unit: text(30).min(1, 'Satuan wajib diisi.'), date: dateSchema, reason: text(), notes: text() }).strict().refine(v => v.type !== 'DITOLAK' || v.reason.length >= 3, 'Alasan penolakan material minimal tiga karakter.');
const problem = z.object({ problem: required('Masalah'), date: dateSchema, location: text(500), impact: text(), resolution: text(), status: z.enum(['Belum Ditangani','Sedang Ditangani','Selesai']), notes: text() }).strict();
export const reportSchema = z.object({ editVersion: z.number().int().min(0), reportDate: dateSchema, generalNotes: text(5000), activities: z.array(activitySchema).min(1, 'Isi minimal satu kegiatan.').max(100), workforce: z.array(worker).max(100), weather: z.array(weather).max(4), materials: z.array(material).max(100), problems: z.array(problem).max(100) }).strict().superRefine((data, ctx) => {
  if (new Set(data.activities.map(a => a.id)).size !== data.activities.length) ctx.addIssue({ code: 'custom', path: ['activities'], message: 'Identitas kegiatan tidak boleh ganda.' });
  if (new Set(data.weather.map(w => w.period)).size !== data.weather.length) ctx.addIssue({ code: 'custom', path: ['weather'], message: 'Setiap waktu cuaca hanya boleh diisi sekali.' });
  if ([...data.materials, ...data.problems].some(row => row.date !== data.reportDate)) ctx.addIssue({ code: 'custom', path: ['reportDate'], message: 'Tanggal material dan masalah harus sama dengan tanggal laporan.' });
});
export const versionSchema = z.object({ editVersion: z.number().int().positive() }).strict();
export const reviewSchema = versionSchema.extend({ kind: z.enum(['TECHNICAL_NOTE','APPROVE','REQUEST_CHANGES']), note: text(5000) }).strict().refine(v=>v.kind==='APPROVE'||v.note.length>=3,'Catatan pemeriksaan atau alasan perbaikan minimal tiga karakter.');
export const correctionSchema = versionSchema.extend({ reason: text(2000).min(3,'Alasan koreksi minimal tiga karakter.') }).strict();
export type Review = { id:string; kind:'TECHNICAL_NOTE'|'APPROVE'|'REQUEST_CHANGES'; note:string; actorName:string; createdAt:string; editVersion:number };
export type ReportWorkflow = { revision:number; logicalId:string; correctionReason:string; isAuthoritative:boolean; canReview:boolean; canNote:boolean; canCorrect:boolean; canDelete:boolean; reviews:Review[]; history:{id:string;revision:number;status:keyof typeof reportStatuses;correctionReason:string;isAuthoritative:boolean}[] };
export const photoSchema = z.object({ editVersion: z.number().int().positive(), activityId: z.string().uuid('Pilih kegiatan yang valid.'), caption: required('Keterangan foto'), location: text(500), takenDate: dateSchema, mime: z.enum(['image/jpeg','image/png'], { error: 'Foto harus JPEG atau PNG.' }), data: z.string().min(1).max(6990508, 'Ukuran foto maksimal 5 MiB.') }).strict();
export type ReportInput = z.infer<typeof reportSchema>;
export type Activity = ReportInput['activities'][number] & { unit: string; workCode: string; workName: string };
export type Photo = { id: string; activityId: string; workItemId: string | null; caption: string; location: string; takenDate: string; uploadedBy: string; uploadedByName: string; createdAt: string; url: string; reportId: string; reportNumber: string };
export type Report = Omit<ReportInput,'activities'> & ReportWorkflow & { id: string; projectId: string; reportNumber: string; status: keyof typeof reportStatuses; createdBy: string; createdByName: string; createdAt: string; submittedAt: string | null; planVersionId: string; planName: string; projectName: string; contractNumber: string; contractorName: string; startDate: string; endDate: string; calendar: ReturnType<typeof position>; workforceTotal: number; activities: Activity[]; photos: Photo[]; canEdit: boolean };
// workItems includes GROUP rows for option labels; only ITEM rows may be selected.
export type ReportList = { reports: { id: string; reportNumber: string; reportDate: string; revision:number; isAuthoritative:boolean; status: keyof typeof reportStatuses; createdByName: string; createdBy:string }[]; creators:{id:string;name:string}[]; canCreate: boolean; today: string; workItems: WorkItemRecord[] };
export const emptyReport = (date: string): ReportInput => ({ editVersion: 0, reportDate: date, generalNotes: '', activities: [], workforce: [], weather: [], materials: [], problems: [] });
