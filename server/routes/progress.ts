import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { projectProgress } from '../services/progress.js';
import { periodReport } from '../services/period-reports.js';
import { dashboard, projectMonitoring, projectGallery, projectHistory } from '../services/monitoring.js';

export const progressRoutes: FastifyPluginAsync<{ db: Pool }> = async (app, { db }) => {
  app.get('/api/dashboard', request => dashboard(db, request.currentUser!.id));
  app.get<{ Params: { id: string } }>('/api/projects/:id/monitoring', request => projectMonitoring(db, request.currentUser!.id, request.params.id, request.query));
  app.get<{ Params: { id: string } }>('/api/projects/:id/gallery', request => projectGallery(db, request.currentUser!.id, request.params.id, request.query));
  app.get<{ Params: { id: string } }>('/api/projects/:id/history', request => projectHistory(db, request.currentUser!.id, request.params.id));
  app.get<{ Params: { id: string } }>('/api/projects/:id/period-reports', request => periodReport(db, request.currentUser!.id, request.params.id, request.query));
  app.get<{ Params: { id: string } }>('/api/projects/:id/progress', request => projectProgress(db, request.currentUser!.id, request.params.id, request.query));
};
