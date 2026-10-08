import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { deleteWorkItem, listWorkItems, saveWorkItem } from '../services/work-items.js';
import { importWorkbookWork, previewWorkbookWork } from '../services/workbook-work.js';

export const workItemRoutes: FastifyPluginAsync<{ db: Pool }> = async (app, { db }) => {
  app.get<{ Params: { id: string } }>('/api/projects/:id/work-items/workbook', async request => previewWorkbookWork(db, request.currentUser!.id, request.params.id));
  app.post<{ Params: { id: string } }>('/api/projects/:id/work-items/workbook', async (request, reply) => reply.status(201).send(await importWorkbookWork(db, request.currentUser!.id, request.params.id, request.body)));
  app.get<{ Params: { id: string } }>('/api/projects/:id/work-items', async (request) => listWorkItems(db, request.currentUser!.id, request.params.id));
  app.post<{ Params: { id: string } }>('/api/projects/:id/work-items', async (request, reply) => reply.status(201).send({ item: await saveWorkItem(db, request.currentUser!.id, request.params.id, null, request.body) }));
  app.patch<{ Params: { id: string; itemId: string } }>('/api/projects/:id/work-items/:itemId', async (request) => ({ item: await saveWorkItem(db, request.currentUser!.id, request.params.id, request.params.itemId, request.body) }));
  app.delete<{ Params: { id: string; itemId: string } }>('/api/projects/:id/work-items/:itemId', async (request, reply) => { await deleteWorkItem(db, request.currentUser!.id, request.params.id, request.params.itemId, request.body); return reply.status(204).send(); });
};
