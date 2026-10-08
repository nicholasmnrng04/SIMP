import { z } from 'zod';
import { dateSchema } from './projects.js';

export function scaled(value: string, places: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error('Angka desimal tidak valid.');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > places) throw new Error('Presisi angka melebihi batas.');
  return BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0') || '0');
}
export function decimal(value: bigint, places: number): string {
  const factor = 10n ** BigInt(places);
  return places ? `${value / factor}.${String(value % factor).padStart(places, '0')}` : value.toString();
}
export function displayDecimal(value: string, places = 2): string {
  const precision = value.split('.')[1]?.length ?? 0;
  const integer = scaled(value, precision);
  const rounded = precision > places ? (integer + 10n ** BigInt(precision - places) / 2n) / 10n ** BigInt(precision - places) : integer * 10n ** BigInt(places - precision);
  const [whole, fraction] = decimal(rounded, places).split('.');
  return BigInt(whole).toLocaleString('id-ID') + (fraction ? `,${fraction}` : '');
}
const text = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter.`);
export const workItemSchema = z.object({
  parentId: z.string().min(1, 'Pilih kelompok induk yang valid.').nullable(),
  kind: z.enum(['GROUP', 'ITEM'], { error: 'Pilih jenis pekerjaan.' }),
  code: text(60).min(1, 'Kode pekerjaan wajib diisi.'), name: text(250).min(1, 'Nama pekerjaan wajib diisi.'),
  description: text(3000), unit: text(30),
  contractVolume: z.string().regex(/^\d{1,12}(\.\d{1,6})?$/, 'Volume harus nonnegatif, maksimal 12 angka bulat dan 6 desimal.'),
  unitPrice: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Harga harus nonnegatif, maksimal 12 angka bulat dan 2 desimal.'),
  startDate: dateSchema.nullable(), endDate: dateSchema.nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE'], { error: 'Pilih status pekerjaan.' }), notes: text(3000),
}).strict().superRefine((data, ctx) => {
  if (data.kind === 'ITEM' && !data.unit) ctx.addIssue({ code: 'custom', path: ['unit'], message: 'Satuan wajib diisi untuk item pekerjaan.' });
  if (data.kind === 'GROUP' && (Number(data.contractVolume) !== 0 || Number(data.unitPrice) !== 0 || data.unit !== '')) ctx.addIssue({ code: 'custom', path: ['kind'], message: 'Kelompok tidak memiliki volume, harga atau satuan sendiri.' });
  if (!!data.startDate !== !!data.endDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Isi tanggal mulai dan selesai sekaligus, atau kosongkan keduanya.' });
  if (data.startDate && data.endDate && data.endDate < data.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Tanggal selesai tidak boleh sebelum mulai.' });
});
export type WorkItemInput = z.infer<typeof workItemSchema>;
export interface WorkItemRecord extends WorkItemInput { id: string }
export interface WorkItem extends WorkItemRecord { depth: number; amount: string; weight: string | null; displayWeight: string | null }
export interface WorkCalculation {
  items: WorkItem[]; totalAmount: string; totalWeight: string | null; displayedWeightTotal: string; leafCount: number; warning: string | null;
}
export interface WorkList extends WorkCalculation { canManage: boolean; frozenAt: string | null; freezeReason: string | null }
export const workItemDefaults: WorkItemInput = { parentId: null, kind: 'ITEM', code: '', name: '', description: '', unit: '', contractVolume: '0', unitPrice: '0', startDate: null, endDate: null, status: 'ACTIVE', notes: '' };
