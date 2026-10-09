import { z } from 'zod';
import { dateSchema } from './projects.js';

export const activityQuery = z.object({
  projectId: z.string().uuid().optional(),
  action: z.string().regex(/^[A-Z_]{2,80}$/).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
}).strict().refine(value => !value.from || !value.to || value.from <= value.to, 'Tanggal akhir tidak boleh sebelum tanggal awal.');

export interface ActivityEntry {
  id: string;
  date: string;
  actor: string;
  action: string;
  projectId: string | null;
  projectName: string | null;
  url: string | null;
}

export interface ActivityPage {
  entries: ActivityEntry[];
  total: number;
  page: number;
  pageSize: number;
}
