import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { readConfig } from '../server/config.js';
import { openDatabase } from '../server/db/database.js';
import { assertPhotoStorageReady } from '../server/services/photo-files.js';

type VercelRequest = IncomingMessage & {
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

let appPromise: Promise<FastifyInstance> | undefined;

async function application(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = (async () => {
      const config = readConfig();
      assertPhotoStorageReady();
      const db = openDatabase(config.databaseUrl, config.databaseSchema);
      const app = buildApp({
        db, logLevel: config.logLevel, serveClient: false,
        allowedOrigins: config.allowedOrigins, cookieSecure: config.cookieSecure,
        projectTimezone: config.projectTimezone, uploadDir: config.uploadDir,
      });
      app.addHook('onClose', async () => { await db.end(); });
      await app.ready();
      return app;
    })();
    appPromise.catch(() => { appPromise = undefined; });
  }
  return appPromise;
}

export default async function handler(request: VercelRequest, response: ServerResponse): Promise<void> {
  try {
    const app = await application();
    const incoming = new URL(request.url ?? '/api', 'http://localhost');
    const rewritePath = request.query?.path ?? incoming.searchParams.get('path') ?? undefined;
    const path = incoming.pathname === '/api/index' && rewritePath
      ? `/api/${Array.isArray(rewritePath) ? rewritePath.join('/') : rewritePath}`
      : incoming.pathname;
    incoming.searchParams.delete('path');
    const headers = { ...request.headers };
    delete headers['content-length'];
    let payload: string | Buffer | undefined;
    if (request.body !== undefined) {
      payload = typeof request.body === 'string' || Buffer.isBuffer(request.body)
        ? request.body : JSON.stringify(request.body);
    } else if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      if (chunks.length) payload = Buffer.concat(chunks);
    }
    const result = await app.inject({
      method: (request.method ?? 'GET') as 'GET',
      url: `${path}${incoming.search}`,
      headers,
      ...(payload === undefined ? {} : { payload }),
    });
    response.statusCode = result.statusCode;
    for (const [name, value] of Object.entries(result.headers)) {
      if (value !== undefined) response.setHeader(name, value);
    }
    response.end(result.rawPayload);
  } catch {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Layanan demo belum siap. Periksa konfigurasi server.' } }));
  }
}
