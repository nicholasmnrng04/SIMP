import path from 'node:path';
import { z } from 'zod';

const environment = z.object({
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url().refine((value) => {
    try { return ['postgres:', 'postgresql:'].includes(new URL(value).protocol); }
    catch { return false; }
  }),
  DATABASE_SCHEMA: z.string().regex(/^[a-z][a-z0-9_]{0,62}$/).default('public'),
  UPLOAD_DIR: z.string().min(1).default('./storage/uploads'),
  PROJECT_TIMEZONE: z.string().default('Asia/Jakarta').refine((value) => {
    try { new Intl.DateTimeFormat('id-ID', { timeZone: value }); return true; }
    catch { return false; }
  }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  APP_ORIGINS: z.string().default('http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3001,http://localhost:3001').transform((value) => value.split(',').map((origin) => origin.trim())).refine((values) => values.length > 0 && values.every((value) => {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && url.origin === value; } catch { return false; }
  })),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = environment.safeParse(env);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Konfigurasi tidak valid. Periksa: ${fields}.`);
  }
  const config = result.data;
  return {
    host: config.HOST, port: config.PORT,
    databaseUrl: config.DATABASE_URL,
    databaseSchema: config.DATABASE_SCHEMA,
    uploadDir: path.resolve(config.UPLOAD_DIR),
    projectTimezone: config.PROJECT_TIMEZONE,
    logLevel: config.LOG_LEVEL,
    allowedOrigins: config.APP_ORIGINS,
    cookieSecure: config.COOKIE_SECURE,
  };
}
