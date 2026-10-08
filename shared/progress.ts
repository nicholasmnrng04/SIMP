import { z } from 'zod';
import { dateSchema } from './projects.js';
import type { WorkItem } from './work-items.js';

export const progressQuery = z.object({ from: dateSchema.optional(), cutoff: dateSchema.optional(), planVersionId: z.string().uuid('Pilih versi rencana yang valid.').optional(), workItemId: z.string().uuid('Pilih pekerjaan yang valid.').optional() }).strict().refine(q => !q.from || !q.cutoff || q.from <= q.cutoff, 'Awal periode tidak boleh melewati tanggal cut-off.');
export type ProgressQuery = z.infer<typeof progressQuery>;
export type Partition<T> = { previous: T; current: T; cumulative: T };
export type ProgressValue = { quantity: string | null; physical: string | null; weighted: string | null };
export type ProgressItem = WorkItem & { actual: Partition<ProgressValue>; target: Partition<ProgressValue>; deviation: string | null; sourceCount: number };
export type ProgressSource = { activityId: string; workItemId: string; description: string; quantity: string; reportId: string; logicalId: string; revision: number; reportNumber: string; reportDate: string; reportPlanVersionId: string; approvedAt: string | null; approvedByName: string | null; bucket: 'previous' | 'current'; reportUrl: string };
export type ProgressPlan = { id: string; name: string; versionNumber: number; isBaseline: boolean; effectiveDate: string; startDate: string; endDate: string };
export type ProgressResult = {
  projectId: string; projectName: string; today: string; from: string; cutoff: string; calculatedAt: string;
  state: 'NO_BASELINE' | 'NO_EFFECTIVE_PLAN' | 'READY'; basisVersionId: string | null; basisTotalAmount: string | null;
  plans: ProgressPlan[]; selectedPlanId: string | null; effectivePlanId: string | null; selectionMode: 'EFFECTIVE' | 'EXPLICIT';
  workItems: { id: string; code: string; name: string }[]; selectedWorkItemId: string | null; items: ProgressItem[];
  total: { actual: Partition<string | null>; target: Partition<string | null>; deviation: string | null };
  sourceCount: number; sources: ProgressSource[]; traceRestricted: boolean; sourceVersion: string; warning: string | null;
};
