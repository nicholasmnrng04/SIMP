import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { dateSchema } from '../../shared/projects.js';
import { planContext, planSeries, publishPlan, previewWorkbookTargets } from '../services/plans.js';

export const planRoutes: FastifyPluginAsync<{ db: Pool }> = async (app, { db }) => {
  app.get<{ Params: { id: string } }>('/api/projects/:id/plans', async request => {
    const query = z.object({ cutoff: dateSchema.optional() }).strict().parse(request.query);
    return planContext(db, request.currentUser!.id, request.params.id, query.cutoff);
  });
  app.post<{ Params: { id: string } }>('/api/projects/:id/plans', async (request, reply) => reply.status(201).send(await publishPlan(db, request.currentUser!.id, request.params.id, request.body)));
  app.get<{ Params: { id: string } }>('/api/projects/:id/plans/workbook-targets', async request => previewWorkbookTargets(db, request.currentUser!.id, request.params.id));
  app.get<{ Params: { id: string; versionId: string } }>('/api/projects/:id/plans/:versionId/series', async request => {
    const query = z.object({ type: z.enum(['WEEKLY', 'MONTHLY']) }).strict().parse(request.query);
    return planSeries(db, request.currentUser!.id, request.params.id, request.params.versionId, query.type);
  });
};
