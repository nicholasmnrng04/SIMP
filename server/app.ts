import { resolve } from 'node:path';
import type { Pool } from 'pg';
import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import staticFiles from '@fastify/static';
import { ZodError } from 'zod';
import { AppError } from './errors.js';
import { identityRoutes } from './routes/identity.js';
import type { ApiErrorResponse, HealthResponse } from '../shared/contracts.js';

interface AppOptions {
  db: Pool;
  logLevel?: string;
  serveClient?: boolean;
  allowedOrigins?: string[];
  cookieSecure?: boolean;
  projectTimezone?: string;
  uploadDir?: string;
}

export function buildApp({ db, logLevel = 'silent', serveClient = false,
  allowedOrigins = ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:3001', 'http://localhost:3001'],
  cookieSecure = false, projectTimezone = 'Asia/Jakarta', uploadDir = resolve('storage/uploads'),
}: AppOptions) {
  const app = Fastify({
    logger: { level: logLevel, redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'] },
    bodyLimit: 1024 * 1024,
  });

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: { code: error.code, message: error.message, requestId: request.id } } satisfies ApiErrorResponse);
    }
    if (error instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = issue.path.join('.');
        if (key && !fields[key]) fields[key] = issue.code === 'invalid_type' ? 'Periksa kembali isian ini.' : issue.message;
      }
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Data belum dapat disimpan. Silakan periksa kembali isian Anda.', requestId: request.id, fields } } satisfies ApiErrorResponse);
    }
    const invalid = !!error.validation || (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500);
    if (!invalid) request.log.error({ err: error, requestId: request.id }, 'Permintaan gagal.');
    const response: ApiErrorResponse = { error: {
      code: invalid ? 'INVALID_REQUEST' : 'INTERNAL_ERROR',
      message: invalid ? 'Data belum dapat diproses. Silakan periksa kembali isian Anda.' : 'Layanan belum dapat memproses permintaan. Silakan coba kembali.',
      requestId: request.id,
    } };
    void reply.status(invalid ? (error.statusCode ?? 400) : 500).send(response);
  });

  void app.register(identityRoutes, { db, allowedOrigins, cookieSecure, projectTimezone, uploadDir });

  app.get('/api/health', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    try {
      const migration = await db.query('SELECT name FROM schema_migrations LIMIT 1');
      if (migration.rowCount === 0) throw new Error('Migration belum diterapkan.');
      const result: HealthResponse = { status: 'ok', message: 'Layanan siap digunakan.' };
      return result;
    } catch {
      return reply.status(503).send({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Layanan belum siap. Silakan coba kembali.', requestId: _request.id } } satisfies ApiErrorResponse);
    }
  });

  if (serveClient) {
    void app.register(staticFiles, { root: resolve('dist/client'), wildcard: false });
  }
  app.setNotFoundHandler((request, reply) => {
    const pathname = request.url.split('?')[0];
    if (serveClient && request.method === 'GET' && !pathname.startsWith('/api/') && pathname !== '/api' && !pathname.includes('.')) {
      return reply.sendFile('index.html');
    }
    return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Halaman atau layanan tidak ditemukan.', requestId: request.id } } satisfies ApiErrorResponse);
  });
  return app;
}
