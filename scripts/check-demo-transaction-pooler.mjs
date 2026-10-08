import { openDatabase } from '../dist/server/db/database.js';
import { readFileSync } from 'node:fs';

const direct = new URL(process.env.DEMO_DATABASE_URL ?? '');
const sessionHost = process.env.DEMO_DB_SESSION_HOST;
if (!/^db\.[a-z0-9-]+\.supabase\.co$/.test(direct.hostname)
  || !/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(sessionHost ?? '')) {
  throw new Error('Konfigurasi Supabase demo belum valid.');
}
const projectRef = direct.hostname.slice(3, -'.supabase.co'.length);
direct.hostname = sessionHost;
direct.username = `postgres.${projectRef}`;
direct.port = '6543';
direct.searchParams.set('sslmode', 'require');
process.env.DATABASE_CA_BASE64 = readFileSync(process.env.DEMO_DB_CA_FILE ?? '').toString('base64');
const db = openDatabase(direct.toString(), 'public');
try {
  await db.query('SELECT 1');
  console.log('Transaction pooler Supabase: koneksi baca-saja berhasil.');
} catch (error) {
  const code = typeof error === 'object' && error && 'code' in error ? error.code : 'TIDAK_DIKETAHUI';
  console.error(`Transaction pooler Supabase belum siap (${String(code)}). URL/password tidak ditampilkan.`);
  process.exitCode = 1;
} finally {
  await db.end();
}
