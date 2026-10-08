import { z } from 'zod';
import { dateSchema } from './projects.js';
import type { WorkItemRecord } from './work-items.js';

export type PeriodType = 'WEEKLY' | 'MONTHLY';
export type WeekConvention = 'PROJECT_START' | 'MONDAY_SUNDAY';
export const newWeekConvention: WeekConvention = 'MONDAY_SUNDAY';
export type Period = { number: number; start: string; end: string; days: number };
const dayMs = 86400000;
export const dayIndex = (date: string) => Date.parse(date + 'T00:00:00Z') / dayMs;
export const dateAt = (day: number) => new Date(day * dayMs).toISOString().slice(0, 10);
export const daysBetween = (start: string, end: string) => dayIndex(end) - dayIndex(start);
export function periods(start: string, end: string, type: PeriodType, weekConvention: WeekConvention = 'PROJECT_START'): Period[] {
  dateSchema.parse(start); dateSchema.parse(end);
  const duration = daysBetween(start, end) + 1;
  if (duration < 1 || duration > 3660) throw new Error('Jadwal rencana harus 1–3.660 hari.');
  const first = new Date(start + 'T00:00:00Z');
  const boundary = (index: number) => {
    if (type === 'WEEKLY') {
      if (weekConvention === 'PROJECT_START') return dayIndex(start) + index * 7;
      const daysToMonday = ((8 - first.getUTCDay()) % 7) || 7;
      return index === 0 ? dayIndex(start) : dayIndex(start) + daysToMonday + (index - 1) * 7;
    }
    const month = first.getUTCMonth() + index, year = first.getUTCFullYear();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return Date.UTC(year, month, Math.min(first.getUTCDate(), lastDay)) / dayMs;
  };
  const result: Period[] = [];
  for (let i = 0; boundary(i) <= dayIndex(end); i++) {
    const a = boundary(i), b = Math.min(boundary(i + 1) - 1, dayIndex(end));
    result.push({ number: i + 1, start: dateAt(a), end: dateAt(b), days: b - a + 1 });
  }
  return result;
}
export function position(start: string, end: string, cutoff: string, weekConvention: WeekConvention = 'PROJECT_START') {
  dateSchema.parse(cutoff);
  const weekly = periods(start, end, 'WEEKLY', weekConvention), monthly = periods(start, end, 'MONTHLY');
  const inside = cutoff >= start && cutoff <= end;
  return { day: inside ? daysBetween(start, cutoff) + 1 : null,
    week: weekly.find(p => p.start <= cutoff && p.end >= cutoff)?.number ?? null,
    month: monthly.find(p => p.start <= cutoff && p.end >= cutoff)?.number ?? null,
    remainingDays: Math.max(daysBetween(cutoff, end), 0), durationDays: daysBetween(start, end) + 1 };
}
const percent = z.string().regex(/^\d{1,3}(\.\d{1,6})?$/, 'Target harus 0–100, maksimal enam desimal.').refine(v => Number(v) <= 100, 'Target maksimal 100%.');
export const planSchema = z.object({
  previousVersionId: z.string().min(1, 'Pilih versi sebelumnya yang valid.').nullable(), basisToken: z.string().regex(/^[a-f0-9]{64}$/, 'Muat ulang basis pekerjaan sebelum menerbitkan.'),
  name: z.string().trim().min(1, 'Nama versi wajib diisi.').max(150, 'Nama versi maksimal 150 karakter.'),
  reason: z.string().trim().min(3, 'Alasan minimal tiga karakter.').max(1000, 'Alasan maksimal 1.000 karakter.'),
  description: z.string().trim().max(5000, 'Penjelasan maksimal 5.000 karakter.'), effectiveDate: dateSchema,
  startDate: dateSchema, endDate: dateSchema, granularity: z.enum(['WEEKLY', 'MONTHLY'], { error: 'Pilih sumber target mingguan atau bulanan.' }),
  items: z.array(z.object({ workItemId: z.string().min(1, 'Pilih pekerjaan yang valid.'), targets: z.array(percent).min(1, 'Isi target periode.').max(523, 'Maksimal 523 periode.') }).strict()).min(1, 'Isi pekerjaan terlebih dahulu.').max(500, 'Maksimal 500 item pekerjaan per versi pada prototype.'),
}).strict().superRefine((data, ctx) => {
  if (data.endDate < data.startDate || daysBetween(data.startDate, data.endDate) > 3659) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Jadwal rencana harus 1–3.660 hari.' });
  if (data.items.reduce((sum, item) => sum + item.targets.length, 0) > 20000) ctx.addIssue({ code: 'custom', path: ['items'], message: 'Maksimal 20.000 isian target per versi untuk prototype.' });
});
export type PlanInput = z.infer<typeof planSchema>;
export type PlanVersion = PlanInput & { id: string; versionNumber: number; isBaseline: boolean; weekConvention: WeekConvention; createdBy: string; createdByName: string; createdAt: string; basis: WorkItemRecord[]; changedItemIds: string[]; scheduleChanged: boolean };
export type PlanContext = { versions: PlanVersion[]; effectiveVersionId: string | null; cutoff: string; today: string; canPublish: boolean; basis: WorkItemRecord[]; basisToken: string; startDate: string; endDate: string };
export type PlanSeries = { periods: (Period & { weighted: string; cumulative: string })[]; items: { workItemId: string; targets: string[]; cumulative: string[]; quantities: string[] }[] };
