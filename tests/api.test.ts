import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../server/app.js';
import { migrate } from '../server/db/migrate.js';
import { readConfig } from '../server/config.js';
import { createTestDatabase } from './support/database.js';

test('health memeriksa PostgreSQL nyata dan tidak memaparkan data internal', async (t) => {
  const sandbox = await createTestDatabase();
  t.after(sandbox.close);
  await migrate(sandbox.db);
  const app = buildApp({ db: sandbox.db });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ok', message: 'Layanan siap digunakan.' });
    assert.equal(response.headers['cache-control'], 'no-store');
    const missing = await app.inject('/api/tidak-ada');
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, 'NOT_FOUND');
    await sandbox.db.end();
    const unavailable = await app.inject('/api/health');
    assert.equal(unavailable.statusCode, 503);
    assert.equal(unavailable.json().error.code, 'SERVICE_UNAVAILABLE');
  } finally { await app.close(); }
});

test('database tanpa migration tidak dinyatakan siap', async (t) => {
  const sandbox = await createTestDatabase();
  t.after(sandbox.close);
  const app = buildApp({ db: sandbox.db });
  try { assert.equal((await app.inject('/api/health')).statusCode, 503); }
  finally { await app.close(); }
});

test('error internal dan validasi API memakai pesan aman Bahasa Indonesia', async (t) => {
  const sandbox = await createTestDatabase();
  t.after(sandbox.close);
  const app = buildApp({ db: sandbox.db });
  app.get('/uji-gagal', () => { throw new Error('rahasia-internal'); });
  app.post('/uji-validasi', { schema: { body: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } }, () => ({ ok: true }));
  try {
    const failed = await app.inject('/uji-gagal');
    assert.equal(failed.statusCode, 500);
    assert.equal(failed.body.includes('rahasia-internal'), false);
    assert.ok(failed.json().error.requestId);
    const invalid = await app.inject({ method: 'POST', url: '/uji-validasi', payload: {} });
    assert.equal(invalid.statusCode, 400);
    assert.match(invalid.json().error.message, /Silakan periksa/);
  } finally { await app.close(); }
});

test('konfigurasi mewajibkan PostgreSQL dan menolak schema atau port yang salah', () => {
  const base = { DATABASE_URL: 'postgresql://user:example@127.0.0.1/simp' };
  assert.equal(readConfig(base).port, 3001);
  assert.throws(() => readConfig({}), /DATABASE_URL/);
  assert.throws(() => readConfig({ ...base, PORT: 'abc' }), /PORT/);
  assert.throws(() => readConfig({ ...base, PROJECT_TIMEZONE: 'Invalid/Zone' }), /PROJECT_TIMEZONE/);
  assert.throws(() => readConfig({ DATABASE_URL: 'sqlite://memory' }), /DATABASE_URL/);
  assert.throws(() => readConfig({ ...base, DATABASE_SCHEMA: 'public,other' }), /DATABASE_SCHEMA/);
  assert.equal(readConfig({ ...base, COOKIE_SECURE: 'true' }).cookieSecure, true);
  assert.throws(() => readConfig({ ...base, COOKIE_SECURE: 'yes' }), /COOKIE_SECURE/);
  assert.throws(() => readConfig({ ...base, APP_ORIGINS: 'https://example.test/path' }), /APP_ORIGINS/);
  assert.throws(() => readConfig({ ...base, APP_ORIGINS: '*' }), /APP_ORIGINS/);
});
