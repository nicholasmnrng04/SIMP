import { resolve } from 'node:path';
import staticFiles from '@fastify/static';
import type { FastifyInstance } from 'fastify';

// Only the standalone server imports this module. Vercel serves dist/client itself.
export function registerStaticClient(app: FastifyInstance): void {
  void app.register(staticFiles, { root: resolve('dist/client'), wildcard: false });
}
