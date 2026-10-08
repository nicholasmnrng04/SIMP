import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { authorization } from '../security/authorization.js';
import { projectStatuses } from '../../shared/projects.js';
import * as service from '../services/projects.js';
import { workItemRoutes } from './work-items.js';
import { planRoutes } from './plans.js';
import { reportRoutes } from './reports.js';
import { progressRoutes } from './progress.js';
import { exportDocument } from '../services/exports.js';
import { renderPdf, renderXlsx } from '../services/export-files.js';
import { exportQuery } from '../../shared/exports.js';

export const projectRoutes: FastifyPluginAsync<{ db: Pool; projectTimezone: string; uploadDir: string }> = async (app, { db, projectTimezone, uploadDir }) => {
  const guard = authorization(db);
  app.addHook('onRequest', guard.requireUser);
  app.get<{ Params: { id: string } }>('/api/projects/:id/exports', async (request,reply) => {
    const query=exportQuery.parse(request.query);
    const {document,images}=await exportDocument(db,request.currentUser!.id,request.params.id,query,uploadDir);
    reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff');
    if(query.format==='web')return document;
    const bytes=query.format==='pdf'?await renderPdf(document,images):await renderXlsx(document,images);
    return reply.header('Content-Disposition',`attachment; filename="simp-${query.kind.toLowerCase()}-${document.generatedAt.slice(0,10)}.${query.format}"`).type(query.format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(bytes);
  });
  await app.register(workItemRoutes, { db });
  await app.register(planRoutes, { db });
  await app.register(reportRoutes, { db, uploadDir });
  await app.register(progressRoutes, { db });
  app.get('/api/project-team-leaders', async (request) => ({ users: await service.teamLeaders(db, request.currentUser!.id) }));
  app.get('/api/projects', async (request) => {
    const query = z.object({ q: z.string().max(200).optional(), archived: z.enum(['true', 'false']).optional(), status: z.enum(projectStatuses).optional() }).strict().parse(request.query);
    return { projects: await service.listProjects(db, request.currentUser!.id, { ...query, archived: query.archived === 'true' }) };
  });
  app.post('/api/projects', async (request, reply) => reply.status(201).send({ project: await service.createProject(db, request.currentUser!.id, request.body, projectTimezone) }));
  app.get<{ Params: { id: string } }>('/api/projects/:id', async (request) => ({ project: await service.getProject(db, request.currentUser!.id, request.params.id) }));
  app.patch<{ Params: { id: string } }>('/api/projects/:id', async (request) => ({ project: await service.updateProject(db, request.currentUser!.id, request.params.id, request.body) }));
  app.patch<{ Params: { id: string } }>('/api/projects/:id/status', async (request) => ({ project: await service.changeProjectStatus(db, request.currentUser!.id, request.params.id, request.body) }));
  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => { await service.archiveProject(db, request.currentUser!.id, request.params.id, request.body); return reply.status(204).send(); });
  app.get<{ Params: { id: string } }>('/api/projects/:id/team', async (request) => ({ members: await service.projectTeam(db, request.currentUser!.id, request.params.id) }));
  app.get<{ Params: { id: string } }>('/api/projects/:id/candidates', async (request) => ({ users: await service.projectCandidates(db, request.currentUser!.id, request.params.id) }));
  app.post<{ Params: { id: string } }>('/api/projects/:id/team', async (request, reply) => reply.status(201).send({ member: await service.saveProjectMember(db, request.currentUser!.id, request.params.id, null, request.body) }));
  app.patch<{ Params: { id: string; memberId: string } }>('/api/projects/:id/team/:memberId', async (request) => ({ member: await service.saveProjectMember(db, request.currentUser!.id, request.params.id, request.params.memberId, request.body) }));
};
