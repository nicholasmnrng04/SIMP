import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import pg from 'pg';

// Hanya mengelola cluster milik workspace ini; tidak memakai Windows service existing.
const root = process.cwd();
const data = path.resolve(root, 'data/postgres');
const stateFile = path.resolve(root, 'data/postgres-local.json');
const command = process.argv[2] || 'up';
const bin = process.env.PG_BIN || 'C:/Program Files/PostgreSQL/17/bin';
const executable = (name) => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
const run = (name, args, check = true) => {
  const result = spawnSync(executable(name), args, {
    encoding: 'utf8', windowsHide: true, timeout: 60000,
    // Server PostgreSQL bertahan setelah pg_ctl selesai; jangan wariskan pipe Node.
    stdio: name === 'pg_ctl' && args.includes('start') ? 'ignore' : 'pipe',
  });
  if (check && (result.error || result.status !== 0)) {
    throw new Error(`${name} gagal: ${result.error?.message || result.stderr || result.stdout}`);
  }
  return result;
};
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";

try {
  if (!['up', 'down', 'status'].includes(command)) throw new Error('Gunakan up, down, atau status.');
  if (!existsSync(executable('pg_ctl'))) throw new Error('PostgreSQL belum ditemukan. Atur PG_BIN ke direktori bin instalasi PostgreSQL.');
  mkdirSync(path.dirname(stateFile), { recursive: true });
  let state;
  if (existsSync(stateFile)) {
    state = JSON.parse(readFileSync(stateFile, 'utf8'));
    if (state.owner !== 'simp-prototype' || state.directory !== data || state.port !== 55432) {
      throw new Error('Metadata cluster tidak cocok dengan workspace. Tidak ada cluster yang diubah.');
    }
  } else {
    if (command !== 'up') throw new Error('Cluster lokal belum disiapkan. Jalankan db:local:up.');
    if (existsSync(data) || existsSync('.env')) throw new Error('Folder cluster atau .env sudah ada. Gunakan DATABASE_URL existing atau periksa konfigurasi lokal sebelum setup.');
    state = { owner: 'simp-prototype', directory: data, port: 55432,
      adminPassword: randomBytes(32).toString('hex'), appPassword: randomBytes(32).toString('hex') };
    writeFileSync(stateFile, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
  }
  if (!existsSync(path.join(data, 'PG_VERSION'))) {
    if (command !== 'up') throw new Error('Cluster belum diinisialisasi.');
    const pwfile = path.resolve(root, 'data/postgres-init-password.tmp');
    writeFileSync(pwfile, state.adminPassword, { flag: 'wx', mode: 0o600 });
    try { run('initdb', ['-D', data, '-U', 'simp_local_admin', '--pwfile', pwfile, '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C']); }
    finally { unlinkSync(pwfile); }
  }
  const running = run('pg_ctl', ['-D', data, 'status'], false).status === 0;
  if (command === 'status') {
    console.log(running ? 'PostgreSQL SIMP berjalan pada 127.0.0.1:55432.' : 'PostgreSQL SIMP sedang berhenti.');
  } else if (command === 'down') {
    if (running) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    console.log('PostgreSQL SIMP berhenti; data tetap tersimpan.');
  } else {
    if (!running) run('pg_ctl', ['-D', data, '-l', path.join(root, 'data/postgres.log'), '-o', '-h 127.0.0.1 -p 55432', '-w', 'start']);
    const admin = new pg.Client({ host: '127.0.0.1', port: 55432, user: 'simp_local_admin', password: state.adminPassword, database: 'postgres', connectionTimeoutMillis: 5000 });
    await admin.connect();
    try {
      if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname = 'simp_app'")).rowCount) {
        await admin.query(`CREATE ROLE simp_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${literal(state.appPassword)}`);
      }
      if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname = 'simp'")).rowCount) {
        await admin.query('CREATE DATABASE simp OWNER simp_app');
      }
    } finally { await admin.end(); }
    const url = `postgresql://simp_app:${state.appPassword}@127.0.0.1:55432/simp`;
    if (!existsSync('.env')) {
      const template = readFileSync('.env.example', 'utf8');
      writeFileSync('.env', template.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url}`), { flag: 'wx', mode: 0o600 });
    } else if (parseEnv(readFileSync('.env', 'utf8')).DATABASE_URL !== url) {
      throw new Error('Cluster lokal siap, tetapi .env menunjuk koneksi lain; konfigurasi .env tidak diubah.');
    }
    console.log('PostgreSQL SIMP siap pada 127.0.0.1:55432. Kredensial lokal tersimpan di .env; tidak ditampilkan.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Pengelolaan PostgreSQL lokal gagal.');
  process.exitCode = 1;
}
