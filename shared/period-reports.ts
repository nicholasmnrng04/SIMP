import { z } from 'zod';
import type { Period, PeriodType } from './plans.js';
import type { ProgressResult } from './progress.js';
import type { ReportInput } from './reports.js';

export const periodReportQuery = z.object({
  type: z.enum(['WEEKLY', 'MONTHLY'], { error: 'Pilih laporan mingguan atau bulanan.' }).default('WEEKLY'),
  period: z.string().regex(/^[1-9]\d{0,2}$/, 'Nomor periode harus bilangan bulat positif.').optional(),
  planVersionId: z.string().uuid('Pilih versi rencana yang valid.').optional(),
}).strict();
export type PeriodReport = {
  type: PeriodType; periods: Period[]; period: Period;
  identity: { projectName: string; activityName: string; location: string; contractNumber: string; contractDate: string;
    initialContractValue: string; currentContractValue: string; clientName: string; consultantName: string; teamLeaderName: string | null;
    startDate: string; endDate: string; scheduleEnd: string; day: number; remainingDays: number; timezone: string };
  progress: ProgressResult;
  statuses: Record<string, string>;
  reports: { id: string; number: string; revision: number; date: string; approvedAt: string; approvedBy: string;
    notes: string; workforce: ReportInput['workforce']; materials: ReportInput['materials']; problems: ReportInput['problems'] }[];
  detailsRestricted: boolean;
};
