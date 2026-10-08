import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate } from '../server/db/migrate.js';
import { bootstrapAdmin } from '../server/services/bootstrap-admin.js';
import { verifyPassword } from '../server/security/password.js';
import { createTestDatabase } from './support/database.js';

test('bootstrap membuat hash, audit, dan tidak menimpa akun saat diulang', async (t) => {
  const sandbox = await createTestDatabase();
  t.after(sandbox.close);
  const { db } = sandbox;
  const input = { name: 'Admin Uji', email: 'ADMIN@example.test', password: 'KataSandiKhususTes-2026' };
  await migrate(db);
  assert.equal(await bootstrapAdmin(db, input), 'created');
  const user = (await db.query('SELECT * FROM users')).rows[0];
  assert.equal(user.email, 'admin@example.test');
  assert.equal(user.role_code, 'ADMINISTRATOR');
  const stored = String(user.password_hash);
  assert.notEqual(stored, input.password);
  assert.equal(await verifyPassword(input.password, stored), true);
  assert.equal(await verifyPassword('kata-sandi-salah', stored), false);
  assert.equal(await verifyPassword(input.password, 'format-tidak-valid'), false);
  assert.equal(await bootstrapAdmin(db, { ...input, name: 'Jangan Ganti', password: 'SandiLainUntukTes-2026' }), 'exists');
  assert.equal((await db.query('SELECT name FROM users')).rows[0].name, input.name);
  assert.equal((await db.query('SELECT password_hash FROM users')).rows[0].password_hash, stored);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM audit_events')).rows[0].count, 1);
  assert.equal(JSON.stringify((await db.query('SELECT * FROM audit_events')).rows).includes(input.password), false);
  await db.query('UPDATE users SET is_active = FALSE');
  await assert.rejects(bootstrapAdmin(db, input), /nonaktif/);
});

test('bootstrap bersamaan tidak menggandakan pengguna dan audit', async (t) => {
  const sandbox = await createTestDatabase();
  t.after(sandbox.close);
  await migrate(sandbox.db);
  const input = { name: 'Admin', email: 'concurrent@example.test', password: 'KataSandiKhususTes-2026' };
  assert.deepEqual((await Promise.all([bootstrapAdmin(sandbox.db, input), bootstrapAdmin(sandbox.db, input)])).sort(), ['created', 'exists']);
  assert.equal((await sandbox.db.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count, 1);
  assert.equal((await sandbox.db.query('SELECT COUNT(*)::int AS count FROM audit_events')).rows[0].count, 1);
});

test('bootstrap menolak konfigurasi kosong sebelum membuat akun', async (t) => {
  const sandbox = await createTestDatabase();
  t.after(sandbox.close);
  await migrate(sandbox.db);
  await assert.rejects(bootstrapAdmin(sandbox.db, {}), /Isi nama/);
  await assert.rejects(bootstrapAdmin(sandbox.db, { name: 'Admin', email: 'bukan-email', password: 'short' }), /Isi nama/);
  assert.equal((await sandbox.db.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count, 0);
});

test('bootstrap tidak menaikkan hak akun yang memakai email sama', async (t) => {
  const sandbox = await createTestDatabase();
  t.after(sandbox.close);
  await migrate(sandbox.db);
  await sandbox.db.query(`INSERT INTO users (id, name, email, password_hash, role_code)
    VALUES ('u', 'Inspector', 'user@example.test', 'hash-fixture', 'INSPECTOR')`);
  await assert.rejects(bootstrapAdmin(sandbox.db, { name: 'Admin', email: 'user@example.test', password: 'KataSandiKhususTes-2026' }), /akun lain/);
  assert.equal((await sandbox.db.query('SELECT role_code FROM users')).rows[0].role_code, 'INSPECTOR');
});
