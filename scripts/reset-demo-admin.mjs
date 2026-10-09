import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readConfig } from '../dist/server/config.js';
import { openDatabase, transaction } from '../dist/server/db/database.js';
import { hashPassword } from '../dist/server/security/password.js';

const output = resolve('.tmp/admin-demo-login.txt');
let fileWritten = false;
let databaseUpdated = false;
let db;

try {
  const direct = new URL(process.env.DEMO_DATABASE_URL ?? '');
  const match = /^db\.([a-z0-9-]+)\.supabase\.co$/.exec(direct.hostname);
  const sessionHost = process.env.DEMO_DB_SESSION_HOST?.trim();
  if (!match || direct.port !== '5432' || decodeURIComponent(direct.username) !== 'postgres'
    || direct.pathname !== '/postgres' || !/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(sessionHost ?? '')) {
    throw new Error('Target database demo Supabase tidak valid.');
  }
  const config = readConfig({ ...process.env, DATABASE_URL: direct.toString() });
  if (config.databaseSchema !== 'public') throw new Error('Database demo harus memakai schema public.');
  const caPath = resolve(process.env.DEMO_DB_CA_FILE ?? '');
  if (!readFileSync(caPath, 'utf8').includes('-----BEGIN CERTIFICATE-----')) {
    throw new Error('Sertifikat CA Supabase tidak valid.');
  }
  direct.hostname = sessionHost;
  direct.username = `postgres.${match[1]}`;
  direct.searchParams.set('sslmode', 'verify-full');
  direct.searchParams.set('sslrootcert', caPath);
  db = openDatabase(direct.toString(), 'public');

  const administrators = (await db.query(
    "SELECT id, email FROM users WHERE role_code = 'ADMINISTRATOR' AND is_active = TRUE",
  )).rows;
  if (administrators.length !== 1) {
    throw new Error('Pemulihan otomatis hanya berlaku jika ada tepat satu Administrator aktif.');
  }
  const administrator = administrators[0];
  const password = randomBytes(24).toString('base64url');
  const hash = await hashPassword(password);
  await mkdir(resolve('.tmp'), { recursive: true });
  await writeFile(output,
    `SIMP demo - kredensial pemulihan Administrator\nEmail: ${administrator.email}\nKata sandi baru: ${password}\n\nSetelah berhasil masuk, ganti kata sandi lewat menu Pengguna lalu hapus berkas ini.\n`,
    { flag: 'wx', mode: 0o600 },
  );
  fileWritten = true;

  await transaction(db, async (client) => {
    const current = (await client.query(
      "SELECT id FROM users WHERE id = $1 AND role_code = 'ADMINISTRATOR' AND is_active = TRUE FOR UPDATE",
      [administrator.id],
    )).rows[0];
    if (!current) throw new Error('Akun Administrator berubah selama pemulihan.');
    await client.query(
      'UPDATE users SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [administrator.id, hash],
    );
    await client.query('DELETE FROM sessions WHERE user_id = $1', [administrator.id]);
    await client.query(
      `INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, note)
       VALUES ($1, $2, 'user', $2, 'RECOVER_ADMIN_PASSWORD', 'Kata sandi Administrator demo dipulihkan lewat CLI lokal.')`,
      [randomUUID(), administrator.id],
    );
  });
  databaseUpdated = true;
  console.log(`Kata sandi Administrator demo berhasil direset. Kredensial tersimpan hanya di ${output}`);
} catch (error) {
  if (fileWritten && !databaseUpdated) await unlink(output).catch(() => {});
  const known = error instanceof Error && [
    'Target database demo Supabase tidak valid.',
    'Database demo harus memakai schema public.',
    'Sertifikat CA Supabase tidak valid.',
    'Pemulihan otomatis hanya berlaku jika ada tepat satu Administrator aktif.',
    'Akun Administrator berubah selama pemulihan.',
  ].includes(error.message);
  const fileExists = typeof error === 'object' && error && 'code' in error && error.code === 'EEXIST';
  console.error(known ? error.message : fileExists
    ? `Berkas ${output} sudah ada. Hapus setelah kredensial lama tidak diperlukan sebelum menjalankan reset lagi.`
    : 'Reset gagal. Periksa koneksi demo dan sertifikat CA; database lokal tidak disentuh.');
  process.exitCode = 1;
} finally {
  if (db) await db.end();
}
