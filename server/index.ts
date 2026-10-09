import { mkdirSync } from 'node:fs';
import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { migrate } from './db/migrate.js';

const config = readConfig();
const db = openDatabase(config.databaseUrl, config.databaseSchema);
try {
  await migrate(db);
  mkdirSync(config.uploadDir, { recursive: true });
  const serveClient = import.meta.url.endsWith('.js');
  const app = buildApp({ db, logLevel: config.logLevel, serveClient, allowedOrigins: config.allowedOrigins, cookieSecure: config.cookieSecure, projectTimezone: config.projectTimezone, uploadDir: config.uploadDir });
  if (serveClient) {
    const { registerStaticClient } = await import('./static-client.js');
    registerStaticClient(app);
  }
  app.addHook('onClose', async () => { await db.end(); });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void app.close().catch(() => { process.exitCode = 1; }); });
  }
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  if (!db.ended) await db.end();
  console.error(error instanceof Error ? error.message : 'Aplikasi gagal dijalankan.');
  process.exitCode = 1;
}
