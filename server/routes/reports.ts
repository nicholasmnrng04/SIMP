import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import * as service from '../services/reports.js';
type Params = { id: string; reportId: string; photoId: string; workItemId: string };
export const reportRoutes: FastifyPluginAsync<{db:Pool;uploadDir:string}> = async (app,{db,uploadDir}) => {
  const root='/api/projects/:id/reports';
  app.get<{Params:Params}>(root,async req=> service.listReports(db,req.currentUser!.id,req.params.id,req.query));
  app.post<{Params:Params}>(root,async (req,reply)=> reply.status(201).send(await service.saveReport(db,req.currentUser!.id,req.params.id,null,req.body)));
  app.get<{Params:Params}>(`${root}/:reportId`,async req=> service.getReport(db,req.currentUser!.id,req.params.id,req.params.reportId));
  app.post<{Params:Params}>(`${root}/:reportId/reviews`,async (req,reply)=> {await service.reviewReport(db,req.currentUser!.id,req.params.id,req.params.reportId,req.body);return reply.status(204).send();});
  app.post<{Params:Params}>(`${root}/:reportId/corrections`,async (req,reply)=> reply.status(201).send(await service.correctReport(db,uploadDir,req.currentUser!.id,req.params.id,req.params.reportId,req.body)));
  app.patch<{Params:Params}>(`${root}/:reportId`,async req=> service.saveReport(db,req.currentUser!.id,req.params.id,req.params.reportId,req.body));
  app.delete<{Params:Params}>(`${root}/:reportId`,async (req,reply)=> { await service.deleteReport(db,uploadDir,req.currentUser!.id,req.params.id,req.params.reportId,req.body); return reply.status(204).send(); });
  app.post<{Params:Params}>(`${root}/:reportId/submit`,async (req,reply)=> { await service.submitReport(db,req.currentUser!.id,req.params.id,req.params.reportId,req.body); return reply.status(204).send(); });
  app.post<{Params:Params}>(`${root}/:reportId/photos`,{bodyLimit:7*1024*1024},async (req,reply)=> reply.status(201).send(await service.uploadPhoto(db,uploadDir,req.currentUser!.id,req.params.id,req.params.reportId,req.body)));
  app.delete<{Params:Params}>(`${root}/:reportId/photos/:photoId`,async (req,reply)=> {await service.deletePhoto(db,uploadDir,req.currentUser!.id,req.params.id,req.params.reportId,req.params.photoId,req.body);return reply.status(204).send();});
  app.get<{Params:Params}>(`${root}/:reportId/photos/:photoId/file`,async (req,reply)=> {
    const buffer=await service.readPhoto(db,uploadDir,req.currentUser!.id,req.params.id,req.params.reportId,req.params.photoId);
    return reply.type('image/jpeg').header('X-Content-Type-Options','nosniff').header('Content-Disposition','inline; filename="foto-laporan.jpg"').header('Content-Security-Policy',"default-src 'none'; sandbox").send(buffer);
  });
  app.get<{Params:Params}>('/api/projects/:id/work-items/:workItemId/photos',async req=> ({photos:await service.workPhotos(db,req.currentUser!.id,req.params.id,req.params.workItemId)}));
};
