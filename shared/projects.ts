import { z } from 'zod';
import type { RoleCode } from './contracts.js';

export const projectStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'DELAYED', 'COMPLETED', 'CLOSED'] as const;
export type ProjectStatus = typeof projectStatuses[number];
export const projectStatusLabels: Record<ProjectStatus, string> = { NOT_STARTED: 'Belum Dimulai', IN_PROGRESS: 'Berjalan', DELAYED: 'Terlambat', COMPLETED: 'Selesai', CLOSED: 'Ditutup' };
export const dateSchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31') return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Isi tanggal yang valid (1900–9999).');
export function moneyToCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function centsToMoney(value: string): string {
  const cents = BigInt(value);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
export function formatRupiah(value: string): string {
  const [whole, fraction = '00'] = value.split('.');
  return `Rp${BigInt(whole).toLocaleString('id-ID')},${fraction.padEnd(2, '0')}`;
}
const moneySchema = z.string().refine((value) => /^\d{1,14}(\.\d{1,2})?$/.test(value) && moneyToCents(value) <= 9007199254740991n, 'Isi nilai nonnegatif, maksimal Rp90.071.992.547.409,91 dengan dua angka desimal.');
const text = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter.`);
export const projectSchema = z.object({
  projectCode: text(60).min(1, 'Kode proyek wajib diisi.'),
  activityName: text(250), projectName: text(250).min(1, 'Nama pekerjaan wajib diisi.'), location: text(500),
  fiscalYear: z.number().int('Isi tahun berupa bilangan bulat.').min(1900, 'Tahun minimal 1900.').max(9999, 'Tahun maksimal 9999.').nullable(), contractNumber: text(150), contractDate: dateSchema.nullable(),
  initialContractValue: moneySchema, currentContractValue: moneySchema,
  startDate: dateSchema, endDate: dateSchema,
  clientName: text(250), clientAgency: text(250), clientAgencyAddress: text(1000), consultantName: text(250), contractorName: text(250).default(''),
  teamLeaderId: z.string().min(1).nullable(), description: text(5000),
}).strict().refine((data) => data.endDate >= data.startDate, { path: ['endDate'], message: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' });
export type ProjectInput = z.infer<typeof projectSchema>;
export const statusSchema = z.object({ statusOverride: z.enum(projectStatuses).nullable(), reason: text(1000).min(3, 'Isi alasan minimal 3 karakter.') }).strict();
export const archiveSchema = z.object({ confirm: z.literal(true, { error: 'Konfirmasi pengarsipan diperlukan.' }), reason: text(1000).min(3, 'Isi alasan minimal 3 karakter.') }).strict();
export const memberSchema = z.object({
  userId: z.string().min(1, 'Pilih pengguna.'), role: z.enum(['OWNER', 'TEAM_LEADER', 'ENGINEER', 'INSPECTOR'], { error: 'Pilih role penugasan yang tersedia.' }),
  startDate: dateSchema, endDate: dateSchema.nullable(), isActive: z.boolean(),
}).strict().refine((data) => !data.endDate || data.endDate >= data.startDate, { path: ['endDate'], message: 'Tanggal akhir tidak boleh sebelum tanggal mulai.' });
export type MemberInput = z.infer<typeof memberSchema>;
export interface Project extends ProjectInput {
  id: string; durationDays: number; timezone: string; today: string; teamLeaderName: string | null;
  status: ProjectStatus; automaticStatus: ProjectStatus; statusOverride: ProjectStatus | null; statusReason: string | null;
  archivedAt: string | null; archiveReason: string | null; canManage: boolean; canAssignLeadership: boolean;
}
export interface TeamCandidate { id: string; name: string; role: RoleCode }
export interface ProjectMember {
  id: string; userId: string; name: string; email?: string; role: RoleCode; currentRole: RoleCode;
  startDate: string; endDate: string | null; isActive: boolean; userActive: boolean; effective: boolean;
}
export function automaticProjectStatus(today: string, start: string, end: string): ProjectStatus {
  return today < start ? 'NOT_STARTED' : today > end ? 'DELAYED' : 'IN_PROGRESS';
}
