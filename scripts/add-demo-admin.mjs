import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readConfig } from '../dist/server/config.js';
import { openDatabase } from '../dist/server/db/database.js';
import { createUser } from '../dist/server/services/users.js';

const email = process.argv[2]?.trim().toLowerCase();
const name = process.argv[3]?.trim() || 'Administrator SIMP';
const output = resolve('.tmp/administrator-2-login.txt');
let fileWritten = false;
let userCreated = false;
let db;

try {
  if (!email) throw new Error('Alamat email Administrator baru wajib diberikan.');
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

  const existing = await db.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
  if (existing.rowCount) throw new Error('Email Administrator baru sudah digunakan.');
  const actor = (await db.query(
    "SELECT id FROM users WHERE role_code = 'ADMINISTRATOR' AND is_active = TRUE ORDER BY created_at, id LIMIT 1",
  )).rows[0];
  if (!actor) throw new Error('Tidak ada Administrator aktif untuk membuat akun baru.');

  const password = randomBytes(24).toString('base64url');
  await mkdir(resolve('.tmp'), { recursive: true });
  await writeFile(output,
    `SIMP demo - Administrator kedua\nNama: ${name}\nEmail: ${email}\nKata sandi awal: ${password}\n\nSetelah berhasil masuk, ganti kata sandi lewat menu Pengguna lalu hapus berkas ini.\n`,
    { flag: 'wx', mode: 0o600 },
  );
  fileWritten = true;
  const user = await createUser(db, actor.id, {
    name, email, password, role: 'ADMINISTRATOR', isActive: true,
  });
  userCreated = true;
  if (user.role !== 'ADMINISTRATOR' || !user.isActive) {
    throw new Error('Akun Administrator baru tidak aktif.');
  }
  console.log(`Administrator kedua berhasil dibuat. Kredensial tersimpan hanya di ${output}`);
} catch (error) {
  if (fileWritten && !userCreated) await unlink(output).catch(() => {});
  const known = error instanceof Error && [
    'Alamat email Administrator baru wajib diberikan.',
    'Target database demo Supabase tidak valid.',
    'Database demo harus memakai schema public.',
    'Sertifikat CA Supabase tidak valid.',
    'Email Administrator baru sudah digunakan.',
    'Tidak ada Administrator aktif untuk membuat akun baru.',
  ].includes(error.message);
  const fileExists = typeof error === 'object' && error && 'code' in error && error.code === 'EEXIST';
  console.error(known ? error.message : fileExists
    ? `Berkas ${output} sudah ada. Hapus setelah kredensial lama tidak diperlukan sebelum membuat akun baru.`
    : 'Pembuatan Administrator demo gagal. Periksa input dan koneksi demo; database lokal tidak disentuh.');
  process.exitCode = 1;
} finally {
  if (db) await db.end();
}
