import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { AppError } from '../errors.js';
import { authorization } from '../security/authorization.js';
import { login, logout, sessionCookieName, sessionSeconds, sessionUser } from '../services/auth.js';
import { createUser, listUsers, updateUser } from '../services/users.js';
import { activityPage } from '../services/activity.js';
import { updateOwnName, changeOwnPassword, uploadOwnPhoto, ownPhoto, deleteOwnPhoto } from '../services/profile.js';
import { projectRoutes } from './projects.js';

export interface IdentityOptions { db: Pool; allowedOrigins: string[]; cookieSecure: boolean; projectTimezone: string; uploadDir: string }
export const identityRoutes: FastifyPluginAsync<IdentityOptions> = async (app, options) => {
  await app.register(cookie);
  await app.register(rateLimit, { global: false, errorResponseBuilder: () => new AppError(429, 'TOO_MANY_ATTEMPTS', 'Terlalu banyak percobaan masuk. Tunggu satu menit lalu coba kembali.') });
  app.decorateRequest('currentUser', null);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && (!request.headers.origin || !options.allowedOrigins.includes(request.headers.origin))) {
      throw new AppError(403, 'INVALID_ORIGIN', 'Permintaan tidak berasal dari halaman aplikasi yang diizinkan.');
    }
  });
  const guard = authorization(options.db);
  await app.register(projectRoutes, { db: options.db, projectTimezone: options.projectTimezone, uploadDir: options.uploadDir });
  const cookieOptions = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: options.cookieSecure };
  app.post('/api/auth/login', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, bodyLimit: 4096 }, async (request, reply) => {
    const { token, user } = await login(options.db, request.body, request.cookies[sessionCookieName]);
    reply.setCookie(sessionCookieName, token, { ...cookieOptions, maxAge: sessionSeconds });
    return { user };
  });
  app.get('/api/auth/me', { onRequest: guard.requireUser }, async (request) => ({ user: request.currentUser }));
  app.get('/api/activity', { onRequest: guard.requireRoles('ADMINISTRATOR', 'TEAM_LEADER') }, request =>
    activityPage(options.db, request.currentUser!.id, request.query));
  app.patch('/api/profile', { onRequest: guard.requireUser, bodyLimit: 4096 }, async request => {
    await updateOwnName(options.db, request.currentUser!.id, request.body);
    return { user: await sessionUser(options.db, request.cookies[sessionCookieName]) };
  });
  app.post('/api/profile/password', { onRequest: guard.requireUser, config: { rateLimit: { max: 5, timeWindow: '1 minute' } }, bodyLimit: 4096 }, async (request, reply) => {
    await changeOwnPassword(options.db, request.currentUser!.id, request.body);
    reply.clearCookie(sessionCookieName, { path: '/', httpOnly: true, sameSite: 'lax', secure: options.cookieSecure });
    return reply.status(204).send();
  });
  app.post('/api/profile/photo', { onRequest: guard.requireUser, bodyLimit: 1_600_000 }, async request => {
    await uploadOwnPhoto(options.db, options.uploadDir, request.currentUser!.id, request.body);
    return { user: await sessionUser(options.db, request.cookies[sessionCookieName]) };
  });
  app.get('/api/profile/photo', { onRequest: guard.requireUser }, async (request, reply) => {
    const bytes = await ownPhoto(options.db, options.uploadDir, request.currentUser!.id);
    return reply.header('Content-Type', 'image/jpeg').header('Cache-Control', 'private, no-store').send(bytes);
  });
  app.delete('/api/profile/photo', { onRequest: guard.requireUser }, async (request, reply) => {
    await deleteOwnPhoto(options.db, options.uploadDir, request.currentUser!.id);
    return reply.status(204).send();
  });
  app.post('/api/auth/logout', async (request, reply) => {
    await logout(options.db, request.cookies[sessionCookieName]);
    reply.clearCookie(sessionCookieName, cookieOptions);
    return reply.status(204).send();
  });
  app.get('/api/users', { onRequest: guard.requireRoles('ADMINISTRATOR') }, async (request) => ({ users: await listUsers(options.db, request.currentUser!.id) }));
  app.post('/api/users', { onRequest: guard.requireRoles('ADMINISTRATOR'), bodyLimit: 8192 }, async (request, reply) => {
    const user = await createUser(options.db, request.currentUser!.id, request.body);
    return reply.status(201).send({ user });
  });
  app.patch<{ Params: { id: string } }>('/api/users/:id', { onRequest: guard.requireRoles('ADMINISTRATOR'), bodyLimit: 8192 }, async (request) => ({
    user: await updateUser(options.db, request.currentUser!.id, request.params.id, request.body),
  }));
};
