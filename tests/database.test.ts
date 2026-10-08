import assert from 'node:assert/strict';
import { appendFileSync, cpSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { openDatabase, transaction } from '../server/db/database.js';
import { readConfig } from '../server/config.js';
import { migrate, migrationsDirectory } from '../server/db/migrate.js';
import { temporaryDirectory } from './helpers.js';
import { createTestDatabase } from './support/database.js';

test('migration 009 menambah kontraktor kosong tanpa mengubah data proyek atau history lama', async t => {
  const sandbox = await createTestDatabase(); t.after(sandbox.close);
  const directory = temporaryDirectory(t);
  for (const file of readdirSync(migrationsDirectory)) if (file.endsWith('.sql') && file < '009') copyFileSync(path.join(migrationsDirectory,file),path.join(directory,file));
  await migrate(sandbox.db,directory);
  await sandbox.db.query("INSERT INTO users(id,name,email,password_hash,role_code) VALUES('legacy-admin','Admin','legacy@example.test','fixture','ADMINISTRATOR')");
  await sandbox.db.query("INSERT INTO projects(id,project_code,project_name,start_date,end_date,created_by,updated_by,description) VALUES('legacy-project','OLD','Proyek lama','2026-07-16','2026-07-23','legacy-admin','legacy-admin','Kontraktor dicatat manual dahulu')");
  const before=(await sandbox.db.query('SELECT * FROM projects')).rows[0];
  const history=(await sandbox.db.query('SELECT * FROM schema_migrations ORDER BY name')).rows;
  assert.equal(await migrate(sandbox.db),2); assert.equal(await migrate(sandbox.db),0);
  const after=(await sandbox.db.query('SELECT * FROM projects')).rows[0];
  assert.equal(after.contractor_name,''); delete after.contractor_name; assert.deepEqual(after,before);
  assert.deepEqual((await sandbox.db.query('SELECT * FROM schema_migrations ORDER BY name')).rows.slice(0,8),history);
});

test('migration PostgreSQL berulang dan koneksi baru mempertahankan data', async (t) => {
  const sandbox = await createTestDatabase();
  t.after(sandbox.close);
  const { db, schema } = sandbox;
  assert.equal(await migrate(db), 10);
  assert.equal(await migrate(db), 0);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM roles')).rows[0].count, 5);
  await db.query(`INSERT INTO users (id, name, email, password_hash, role_code)
    VALUES ('test-user', 'Pengguna Uji', 'user@example.test', 'hash-fixture', 'TEAM_LEADER')`);
  await db.query(`INSERT INTO projects (id, project_code, project_name, start_date, end_date, created_by, updated_by)
    VALUES ('test-project', 'P-001', 'Proyek Uji', '2026-07-16', '2026-07-23', 'test-user', 'test-user')`);
  await db.end();
  const reopened = openDatabase(readConfig().databaseUrl, schema);
  try {
    assert.equal(await migrate(reopened), 0);
    const project = (await reopened.query('SELECT project_name, duration_days, start_date FROM projects')).rows[0];
    assert.equal(project.project_name, 'Proyek Uji');
    assert.equal(project.duration_days, 8);
    assert.equal(project.start_date, '2026-07-16');
    await assert.rejects(reopened.query("UPDATE users SET role_code = 'UNKNOWN'"), { code: '23503' });
    await assert.rejects(reopened.query("UPDATE projects SET end_date = '2026-07-15'"), { code: '23514' });
    await assert.rejects(reopened.query("UPDATE projects SET start_date = '2026-02-30'"), { code: '22008' });
    await assert.rejects(reopened.query('UPDATE projects SET initial_contract_value_cents = -1'), { code: '23514' });
    await assert.rejects(reopened.query("DELETE FROM users WHERE id = 'test-user'"), { code: '23503' });
    await assert.rejects(reopened.query(`INSERT INTO users (id, name, email, password_hash, role_code)
      VALUES ('duplicate', 'Duplikat', 'USER@example.test', 'hash-fixture', 'OWNER')`), { code: '23505' });
  } finally { await reopened.end(); }
});

test('dua runner migration bersamaan menerapkan schema satu kali', async (t) => {
  const sandbox = await createTestDatabase();
  t.after(sandbox.close);
  assert.deepEqual((await Promise.all([migrate(sandbox.db), migrate(sandbox.db)])).sort(), [0, 10]);
  assert.equal((await sandbox.db.query('SELECT COUNT(*)::int AS count FROM schema_migrations')).rows[0].count, 10);
});

test('migration yang pernah diterapkan tidak boleh diubah', async (t) => {
  const directory = temporaryDirectory(t);
  const copied = path.join(directory, 'migrations');
  cpSync(migrationsDirectory, copied, { recursive: true });
  const sandbox = await createTestDatabase();
  t.after(sandbox.close);
  await migrate(sandbox.db, copied);
  appendFileSync(path.join(copied, '001_identity_projects.sql'), '\n-- diubah');
  await assert.rejects(migrate(sandbox.db, copied), /berubah/);
  assert.equal((await sandbox.db.query('SELECT COUNT(*)::int AS count FROM roles')).rows[0].count, 5);
});

test('migration gagal dibatalkan tanpa schema setengah jadi', async (t) => {
  const directory = temporaryDirectory(t);
  const copied = path.join(directory, 'migrations');
  cpSync(migrationsDirectory, copied, { recursive: true });
  writeFileSync(path.join(copied, '011_broken.sql'), 'CREATE TABLE incomplete (id TEXT); INVALID SQL;');
  const sandbox = await createTestDatabase();
  t.after(sandbox.close);
  await assert.rejects(migrate(sandbox.db, copied));
  const result = await sandbox.db.query('SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = $1', [sandbox.schema]);
  assert.equal(result.rows[0].count, 0);
});

test('transaksi menggunakan satu client dan membatalkan seluruh perubahan', async (t) => {
  const sandbox = await createTestDatabase();
  t.after(sandbox.close);
  const { db } = sandbox;
  await migrate(db);
  await assert.rejects(transaction(db, async (client) => {
    await client.query("UPDATE roles SET name = 'Berubah' WHERE code = 'OWNER'");
    // Koneksi berbeda tidak boleh melihat perubahan yang belum di-commit.
    assert.equal((await db.query("SELECT name FROM roles WHERE code = 'OWNER'")).rows[0].name, 'Owner');
    throw new Error('gagal');
  }), /gagal/);
  assert.equal((await db.query("SELECT name FROM roles WHERE code = 'OWNER'")).rows[0].name, 'Owner');
});

test('schema tes berbeda tidak saling membaca data', async (t) => {
  const first = await createTestDatabase(), second = await createTestDatabase();
  t.after(first.close); t.after(second.close);
  await migrate(first.db);
  await assert.rejects(second.db.query('SELECT * FROM users'), { code: '42P01' });
});
