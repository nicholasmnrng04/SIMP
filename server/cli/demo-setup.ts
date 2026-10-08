import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
import { migrate } from '../db/migrate.js';
import { bootstrapAdmin } from '../services/bootstrap-admin.js';

const operation = process.argv[2];
if (operation !== 'migrate' && operation !== 'bootstrap' && operation !== 'inspect') {
  console.error('Gunakan perintah db:demo:migrate, db:demo:bootstrap, atau db:demo:inspect.');
  process.exitCode = 1;
} else {
  const demoUrl = process.env.DEMO_DATABASE_URL;
  let host = '';
  try { host = new URL(demoUrl ?? '').hostname; } catch { /* pesan aman di bawah */ }
  if (!/^db\.[a-z0-9-]+\.supabase\.co$/.test(host) || new URL(demoUrl!).port !== '5432') {
    console.error('DEMO_DATABASE_URL harus memakai Direct connection Supabase pada port 5432. Database lokal tidak disentuh.');
    process.exitCode = 1;
  } else {
    try {
      const config = readConfig({ ...process.env, DATABASE_URL: demoUrl });
      if (config.databaseSchema !== 'public') throw new Error('Demo harus memakai schema public.');
      const caFile = process.env.DEMO_DB_CA_FILE;
      if (!caFile) throw new Error('Sertifikat CA Supabase belum dikonfigurasi.');
      const caPath = resolve(caFile);
      if (!readFileSync(caPath, 'utf8').includes('-----BEGIN CERTIFICATE-----')) throw new Error('Sertifikat CA Supabase tidak valid.');
      const verifiedUrl = new URL(config.databaseUrl);
      const sessionHost = process.env.DEMO_DB_SESSION_HOST?.trim();
      if (sessionHost) {
        if (!/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(sessionHost)) {
          throw new Error('Host Session pooler Supabase tidak valid.');
        }
        const projectRef = host.slice(3, -'.supabase.co'.length);
        if (decodeURIComponent(verifiedUrl.username) !== 'postgres' || verifiedUrl.pathname !== '/postgres') {
          throw new Error('URL Direct Supabase tidak sesuai.');
        }
        verifiedUrl.hostname = sessionHost;
        verifiedUrl.username = `postgres.${projectRef}`;
        console.log('Menggunakan Session pooler Supabase untuk koneksi IPv4.');
      }
      verifiedUrl.searchParams.set('sslmode', 'verify-full');
      verifiedUrl.searchParams.set('sslrootcert', caPath);
      const db = openDatabase(verifiedUrl.toString(), config.databaseSchema);
      try {
        if (operation === 'inspect') {
          const result = await db.query(`SELECT
            (SELECT count(*)::int FROM schema_migrations) AS migrations,
            (SELECT count(*)::int FROM users) AS users,
            (SELECT count(*)::int FROM projects) AS projects,
            (SELECT count(*)::int FROM daily_reports) AS reports,
            (SELECT count(*)::int FROM daily_report_photos) AS photos`);
          const row = result.rows[0];
          console.log(`Isi demo: ${row.migrations} migration, ${row.users} akun, ${row.projects} proyek, ${row.reports} laporan, ${row.photos} foto.`);
        } else {
          const count = await migrate(db);
          console.log(`Migration database demo selesai: ${count} migration baru.`);
        }
        if (operation === 'bootstrap') {
          const result = await bootstrapAdmin(db, {
            name: process.env.BOOTSTRAP_ADMIN_NAME,
            email: process.env.BOOTSTRAP_ADMIN_EMAIL,
            password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
          });
          console.log(result === 'created' ? 'Administrator demo berhasil dibuat.' : 'Administrator demo sudah ada; data tidak diubah.');
        }
      } finally { await db.end(); }
    } catch (error) {
      const codes: string[] = [];
      const inspect = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        if ('code' in value && typeof value.code === 'string' && /^[A-Z0-9_]{2,24}$/.test(value.code)) codes.push(value.code);
        if ('cause' in value) inspect(value.cause);
        if ('errors' in value && Array.isArray(value.errors)) value.errors.forEach(inspect);
      };
      inspect(error);
      const code = [...new Set(codes)].join(',') || 'TIDAK_DIKETAHUI';
      const message = error instanceof Error ? error.message : '';
      const sslDetail = /self.signed/i.test(message) ? 'self-signed'
        : /unable to verify|unable to get local issuer|UNABLE_TO_VERIFY/i.test(message) ? 'rantai sertifikat tidak terverifikasi'
        : /hostname|ALTNAME/i.test(message) ? 'nama host sertifikat tidak cocok'
        : /expired/i.test(message) ? 'sertifikat kedaluwarsa'
        : /does not support SSL/i.test(message) ? 'server menolak SSL'
        : /SSL mode|sslmode|SSL parameter/i.test(message) ? 'opsi SSL'
        : 'lainnya';
      const category = /password authentication|invalid password|SASL|SCRAM/i.test(message) ? 'autentikasi'
        : /Host Session pooler Supabase tidak valid/i.test(message) ? 'host Session pooler tidak valid'
        : /URL Direct Supabase tidak sesuai/i.test(message) ? 'URL Direct tidak sesuai'
        : /Sertifikat CA Supabase/i.test(message) ? 'sertifikat CA belum siap'
        : /ENOENT/i.test(message) ? 'berkas sertifikat CA tidak ditemukan'
        : /certificate|SSL|TLS|self.signed/i.test(message) ? `sertifikat SSL: ${sslDetail}`
        : /ENETUNREACH|EHOSTUNREACH|network is unreachable|IPv6/i.test(message) ? 'jaringan IPv6'
        : /ENOTFOUND|DNS|name resolution/i.test(message) ? 'DNS'
        : /EACCES|EPERM|permission denied/i.test(message) ? 'akses jaringan'
        : /ETIMEDOUT|timeout|timed out/i.test(message) ? 'waktu koneksi habis'
        : /Konfigurasi tidak valid/i.test(message) ? 'konfigurasi aplikasi'
        : /Demo harus memakai schema public/i.test(message) ? 'schema harus public'
        : /Migration/i.test(message) ? 'migration'
        : 'belum terklasifikasi';
      const safeMessage = error instanceof Error && /Migration .* berubah|Migration yang telah diterapkan hilang|Schema PostgreSQL belum tersedia/.test(error.message)
        ? error.message
        : category === 'berkas sertifikat CA tidak ditemukan' || category === 'sertifikat CA belum siap'
          ? `Setup database demo tertunda (kode ${code}). Unduh sertifikat CA Supabase dan simpan di data/supabase-ca.crt.`
          : `Setup database demo gagal (kategori ${category}, kode ${code}). Periksa koneksi Direct, SSL, jaringan IPv6, dan isian administrator secara pribadi.`;
      console.error(safeMessage);
      process.exitCode = 1;
    }
  }
}
