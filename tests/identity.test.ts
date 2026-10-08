import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { buildApp } from '../server/app.js';
import { migrate } from '../server/db/migrate.js';
import { bootstrapAdmin } from '../server/services/bootstrap-admin.js';
import { tokenHash } from '../server/services/auth.js';
import { createUser, updateUser } from '../server/services/users.js';
import { verifyPassword } from '../server/security/password.js';
import { roleCodes } from '../shared/contracts.js';
import { createTestDatabase } from './support/database.js';

const password = 'KataSandiKhususTes-2026';
const origin = 'http://127.0.0.1:5173';
const admin = { name: 'Admin Uji', email: 'admin@example.test', password };
async function setup(t: TestContext, cookieSecure = false) {
  const sandbox = await createTestDatabase();
  t.after(sandbox.close);
  await migrate(sandbox.db);
  await bootstrapAdmin(sandbox.db, admin);
  const app = buildApp({ db: sandbox.db, cookieSecure });
  t.after(() => app.close());
  const adminId = (await sandbox.db.query('SELECT id FROM users')).rows[0].id as string;
  const signIn = async (email = admin.email, secret = password, oldCookie?: string) => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin, ...(oldCookie ? { cookie: oldCookie } : {}) }, payload: { email, password: secret } });
    const cookie = String(response.headers['set-cookie'] ?? '').split(';')[0];
    return { response, cookie };
  };
  return { ...sandbox, app, adminId, signIn };
}

test('login generik, cookie aman, rotasi, sesi persisten, kedaluwarsa dan logout', async (t) => {
  const { app, db, signIn } = await setup(t, true);
  for (const email of [admin.email, 'unknown@example.test']) {
    const { response } = await signIn(email, 'KataSandiSalah');
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error.code, 'INVALID_CREDENTIALS');
    assert.equal(response.headers['set-cookie'], undefined);
  }
  const first = await signIn('ADMIN@example.test');
  assert.equal(first.response.statusCode, 200);
  assert.deepEqual(Object.keys(first.response.json().user).sort(), ['email', 'id', 'name', 'role']);
  assert.match(String(first.response.headers['set-cookie']), /HttpOnly/);
  assert.match(String(first.response.headers['set-cookie']), /SameSite=Lax/);
  assert.match(String(first.response.headers['set-cookie']), /Secure/);
  assert.match(String(first.response.headers['set-cookie']), /Max-Age=28800/);
  const token = first.cookie.split('=')[1];
  assert.equal((await db.query('SELECT token_hash FROM sessions')).rows[0].token_hash, tokenHash(token));
  assert.notEqual(token, tokenHash(token));
  const restarted = buildApp({ db });
  try {
    const response = await restarted.inject({ url: '/api/auth/me', headers: { cookie: first.cookie } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
  } finally { await restarted.close(); }
  const second = await signIn(admin.email, password, first.cookie);
  assert.notEqual(first.cookie, second.cookie);
  assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie: first.cookie } })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { origin, cookie: second.cookie } })).statusCode, 204);
  assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie: second.cookie } })).statusCode, 401);
  const expired = await signIn();
  await db.query("UPDATE sessions SET created_at = CURRENT_TIMESTAMP - INTERVAL '9 hours', expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour'");
  assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie: expired.cookie } })).statusCode, 401);
  assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie: 'simp_session=forged' } })).statusCode, 401);
});

test('semua non-Administrator dan sesi kosong ditolak saat memanggil API pengguna langsung', async (t) => {
  const { app, db, adminId, signIn } = await setup(t);
  const payload = { name: 'Pengguna', email: 'new@example.test', password, role: 'ADMINISTRATOR', isActive: true };
  for (const role of [null, ...roleCodes.filter((value) => value !== 'ADMINISTRATOR')]) {
    let cookie = '';
    if (role) {
      const email = `${role.toLowerCase()}@example.test`;
      await createUser(db, adminId, { ...payload, email, role });
      const logged = await signIn(email);
      assert.equal(logged.response.statusCode, 200);
      assert.equal(logged.response.json().user.role, role);
      cookie = logged.cookie;
    }
    for (const method of ['GET', 'POST', 'PATCH'] as const) {
      const response = await app.inject({ method, url: method === 'PATCH' ? `/api/users/${adminId}` : '/api/users', headers: { origin, cookie }, ...(method !== 'GET' ? { payload } : {}) });
      assert.equal(response.statusCode, role ? 403 : 401, `${role}: ${method}`);
    }
  }
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM users WHERE role_code = 'ADMINISTRATOR'")).rows[0].n, 1);
});

test('Administrator mengelola akun dengan validasi, hash, audit dan pencabutan seluruh sesi', async (t) => {
  const { app, db, signIn } = await setup(t);
  const { cookie } = await signIn();
  const headers = { origin, cookie };
  const data = { name: 'Petugas Lapangan', email: 'FIELD@example.test', password, role: 'INSPECTOR', isActive: true };
  const invalid = await app.inject({ method: 'POST', url: '/api/users', headers, payload: { ...data, password: 'pendek' } });
  assert.equal(invalid.statusCode, 400);
  assert.ok(invalid.json().error.fields.password);
  const created = await app.inject({ method: 'POST', url: '/api/users', headers, payload: data });
  assert.equal(created.statusCode, 201);
  const user = created.json().user;
  assert.equal(user.email, 'field@example.test');
  const stored = (await db.query('SELECT password_hash FROM users WHERE id = $1', [user.id])).rows[0].password_hash;
  assert.equal(await verifyPassword(password, stored), true);
  assert.equal((await app.inject({ method: 'POST', url: '/api/users', headers, payload: { ...data, email: user.email } })).statusCode, 409);
  assert.equal((await app.inject({ method: 'POST', url: '/api/users', headers, payload: { ...data, isAdmin: true } })).statusCode, 400);
  const list = await app.inject({ url: '/api/users', headers });
  assert.equal(list.json().users.length, 2);
  assert.equal(list.body.includes('password'), false);
  assert.equal(list.body.includes('token'), false);
  const session1 = await signIn(user.email), session2 = await signIn(user.email);
  const { password: _ignored, ...edit } = data;
  const save = (patch: Record<string, unknown>) => app.inject({ method: 'PATCH', url: `/api/users/${user.id}`, headers, payload: { ...edit, ...patch } });
  assert.equal((await save({ name: 'Nama Diperbarui' })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie: session1.cookie } })).json().user.name, 'Nama Diperbarui');
  assert.equal((await save({ role: 'ENGINEER' })).statusCode, 200);
  for (const session of [session1, session2]) assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie: session.cookie } })).statusCode, 401);
  const changed = await signIn(user.email);
  assert.equal(changed.response.json().user.role, 'ENGINEER');
  assert.equal((await save({ role: 'ENGINEER', isActive: false })).statusCode, 200);
  assert.equal((await signIn(user.email)).response.statusCode, 401);
  assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie: changed.cookie } })).statusCode, 401);
  assert.equal((await save({ role: 'ENGINEER', isActive: true })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie: changed.cookie } })).statusCode, 401);
  const reactivated = await signIn(user.email);
  assert.equal(reactivated.response.statusCode, 200);
  assert.equal((await save({ role: 'ENGINEER', password: 'SandiPengganti-2026' })).statusCode, 200);
  assert.equal((await signIn(user.email)).response.statusCode, 401);
  assert.equal((await signIn(user.email, 'SandiPengganti-2026')).response.statusCode, 200);
  assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie: reactivated.cookie } })).statusCode, 401);
  const audit = JSON.stringify((await db.query('SELECT * FROM audit_events')).rows);
  assert.match(audit, /CREATE_USER/); assert.match(audit, /UPDATE_USER/);
  assert.equal(audit.includes(password), false); assert.equal(audit.includes(stored), false);
  assert.equal(audit.includes('SandiPengganti-2026'), false);
});

test('origin asing/kosong ditolak dan Administrator aktif terakhir tetap terlindungi', async (t) => {
  const { app, db, adminId, signIn } = await setup(t);
  const { cookie } = await signIn();
  const data = { name: admin.name, email: admin.email, role: 'OWNER', isActive: true };
  for (const badOrigin of [undefined, 'https://asing.example']) {
    const response = await app.inject({ method: 'PATCH', url: `/api/users/${adminId}`, headers: { cookie, ...(badOrigin ? { origin: badOrigin } : {}) }, payload: data });
    assert.equal(response.statusCode, 403); assert.equal(response.json().error.code, 'INVALID_ORIGIN');
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie, ...(badOrigin ? { origin: badOrigin } : {}) } })).statusCode, 403);
  }
  const response = await app.inject({ method: 'PATCH', url: `/api/users/${adminId}`, headers: { cookie, origin }, payload: data });
  assert.equal(response.statusCode, 409); assert.equal(response.json().error.code, 'LAST_ADMIN');
  await assert.rejects(updateUser(db, adminId, adminId, { ...data, role: 'ADMINISTRATOR', isActive: false }), /Administrator aktif/);
  const second = await createUser(db, adminId, { ...data, name: 'Admin Kedua', email: 'second@example.test', role: 'ADMINISTRATOR', password });
  const secondSession = await signIn(second.email);
  const results = await Promise.allSettled([
    updateUser(db, adminId, adminId, data),
    updateUser(db, second.id, second.id, { ...data, name: second.name, email: second.email }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM users WHERE role_code = 'ADMINISTRATOR' AND is_active = TRUE")).rows[0].n, 1);
  const codes = await Promise.all([cookie, secondSession.cookie].map(async (value) => (await app.inject({ url: '/api/users', headers: { cookie: value } })).statusCode));
  assert.deepEqual(codes.sort(), [200, 401]);
});

test('percobaan login dibatasi dan memberikan pesan Indonesia', async (t) => {
  const { app } = await setup(t);
  // Payload invalid menghindari hashing berulang; limiter tetap berlaku sebelum validasi kredensial.
  for (let attempt = 0; attempt < 20; attempt++) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: {} })).statusCode, 400);
  }
  const limited = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: admin });
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().error.code, 'TOO_MANY_ATTEMPTS');
  assert.match(limited.json().error.message, /Tunggu satu menit/);
  assert.ok(limited.headers['retry-after']);
});
