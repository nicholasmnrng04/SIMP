import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const direct = new URL(process.env.DEMO_DATABASE_URL ?? '');
const sessionHost = process.env.DEMO_DB_SESSION_HOST;
if (!/^db\.[a-z0-9-]+\.supabase\.co$/.test(direct.hostname)
  || !/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(sessionHost ?? '')) {
  throw new Error('Konfigurasi database demo belum siap untuk pemeriksaan adapter.');
}
const projectRef = direct.hostname.slice(3, -'.supabase.co'.length);
direct.hostname = sessionHost;
direct.username = `postgres.${projectRef}`;
direct.port = '6543';
direct.searchParams.set('sslmode', 'require');
process.env.DATABASE_URL = direct.toString();
process.env.DATABASE_CA_BASE64 = readFileSync(process.env.DEMO_DB_CA_FILE ?? '').toString('base64');
process.env.DATABASE_SCHEMA = 'public';
process.env.COOKIE_SECURE = 'false';
process.env.APP_ORIGINS = 'http://127.0.0.1:5173';
process.env.VERCEL = '1';
process.env.SUPABASE_URL = `https://${projectRef}.supabase.co`;
process.env.SUPABASE_SECRET_KEY = 'kunci-uji-tidak-dipakai';
process.env.SUPABASE_STORAGE_BUCKET = 'simp-report-photos';

const { default: handler } = await import('../dist/api/index.js');
const server = createServer((request, response) => { void handler(request, response); });
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
try {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server uji tidak tersedia.');
  const base = `http://127.0.0.1:${address.port}`;
  const health = await fetch(`${base}/api/health`);
  const rewrittenHealth = await fetch(`${base}/api/index?path=health`);
  const me = await fetch(`${base}/api/auth/me`);
  if (health.status !== 200 || rewrittenHealth.status !== 200 || me.status !== 401) {
    throw new Error(`Adapter API belum sesuai: health=${health.status}, rewrite=${rewrittenHealth.status}, auth/me=${me.status}.`);
  }
  console.log('Adapter Vercel: /api/health dan rewrite 200; /api/auth/me 401 tanpa sesi.');
} finally {
  await new Promise((resolveClose, rejectClose) => server.close(error => error ? rejectClose(error) : resolveClose()));
}
