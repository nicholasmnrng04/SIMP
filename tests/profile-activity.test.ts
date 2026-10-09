import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import sharp from 'sharp';
import { buildApp } from '../server/app.js';
import { migrate } from '../server/db/migrate.js';
import { bootstrapAdmin } from '../server/services/bootstrap-admin.js';
import { createUser } from '../server/services/users.js';
import { verifyPassword } from '../server/security/password.js';
import { createTestDatabase } from './support/database.js';
import { temporaryDirectory } from './helpers.js';

const origin = 'http://127.0.0.1:5173';
const secret = 'KataSandiTes-2026';

test('profil mandiri memperbarui nama, foto privat, dan mencabut seluruh sesi setelah ganti password', async t => {
  const sandbox = await createTestDatabase(); t.after(sandbox.close);
  await migrate(sandbox.db);
  await bootstrapAdmin(sandbox.db, { name: 'Admin', email: 'admin@example.test', password: secret });
  const adminId = (await sandbox.db.query('SELECT id FROM users')).rows[0].id as string;
  const owner = await createUser(sandbox.db, adminId, { name: 'Owner Awal', email: 'owner@example.test', password: secret, role: 'OWNER', isActive: true });
  const app = buildApp({ db: sandbox.db, uploadDir: temporaryDirectory(t) }); t.after(() => app.close());
  const signIn = async (password = secret) => {
    const result = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { email: owner.email, password } });
    return { result, cookie: String(result.headers['set-cookie'] ?? '').split(';')[0] };
  };
  const first = await signIn(), second = await signIn();
  assert.equal(first.result.statusCode, 200);
  const headers = { origin, cookie: first.cookie };
  assert.equal((await app.inject({ method: 'PATCH', url: '/api/profile', headers, payload: { name: 'Owner Baru', role: 'ADMINISTRATOR' } })).statusCode, 400);
  const name = await app.inject({ method: 'PATCH', url: '/api/profile', headers, payload: { name: 'Owner Baru' } });
  assert.equal(name.statusCode, 200);
  assert.equal(name.json().user.name, 'Owner Baru');
  assert.equal(name.json().user.role, 'OWNER');
  const jpeg = await sharp({ create: { width: 360, height: 360, channels: 3, background: '#264261' } }).jpeg().toBuffer();
  const image = await app.inject({ method: 'POST', url: '/api/profile/photo', headers, payload: { mime: 'image/jpeg', data: jpeg.toString('base64') } });
  assert.equal(image.statusCode, 200);
  assert.match(image.json().user.avatarUrl, /\/api\/profile\/photo\?version=/);
  const file = await app.inject({ url: '/api/profile/photo', headers: { cookie: first.cookie } });
  assert.equal(file.statusCode, 200);
  assert.equal(file.headers['content-type'], 'image/jpeg');
  assert.equal((await app.inject({ url: '/api/profile/photo' })).statusCode, 401);
  const adminLogin = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { email: 'admin@example.test', password: secret } });
  const adminCookie = String(adminLogin.headers['set-cookie']).split(';')[0];
  assert.equal((await app.inject({ url: '/api/profile/photo', headers: { cookie: adminCookie } })).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: '/api/profile/photo', headers, payload: { mime: 'image/png', data: jpeg.toString('base64') } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/profile/password', headers, payload: { currentPassword: 'Salah', newPassword: 'SandiBaruPanjang-2026' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/profile/password', headers, payload: { currentPassword: secret, newPassword: 'SandiBaruPanjang-2026' } })).statusCode, 204);
  for (const cookie of [first.cookie, second.cookie]) assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie } })).statusCode, 401);
  assert.equal((await signIn()).result.statusCode, 401);
  const changed = await signIn('SandiBaruPanjang-2026'); assert.equal(changed.result.statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/profile/photo', headers: { origin, cookie: changed.cookie } })).statusCode, 204);
  assert.equal((await app.inject({ url: '/api/profile/photo', headers: { cookie: changed.cookie } })).statusCode, 404);
  assert.equal(await verifyPassword('SandiBaruPanjang-2026', (await sandbox.db.query('SELECT password_hash FROM users WHERE id=$1', [owner.id])).rows[0].password_hash), true);
  const audit = JSON.stringify((await sandbox.db.query("SELECT action,note FROM audit_events WHERE actor_id=$1", [owner.id])).rows);
  for (const action of ['UPDATE_OWN_NAME','UPLOAD_OWN_AVATAR','CHANGE_OWN_PASSWORD','DELETE_OWN_AVATAR']) assert.match(audit, new RegExp(action));
  assert.equal(audit.includes('SandiBaruPanjang-2026'), false);
});

test('Aktivitas hanya menampilkan proyek yang masih ditugaskan kepada Team Leader', async t => {
  const sandbox = await createTestDatabase(); t.after(sandbox.close);
  await migrate(sandbox.db);
  await bootstrapAdmin(sandbox.db, { name: 'Admin', email: 'admin@example.test', password: secret });
  const adminId = (await sandbox.db.query('SELECT id FROM users')).rows[0].id as string;
  const leader = await createUser(sandbox.db, adminId, { name: 'Ketua Tim', email: 'leader@example.test', password: secret, role: 'TEAM_LEADER', isActive: true });
  const owner = await createUser(sandbox.db, adminId, { name: 'Owner', email: 'owner@example.test', password: secret, role: 'OWNER', isActive: true });
  const ids: string[] = [randomUUID(), randomUUID()];
  for (const [index, id] of ids.entries()) {
    await sandbox.db.query(`INSERT INTO projects(id,project_code,project_name,start_date,end_date,created_by,updated_by)
      VALUES($1,$2,$3,CURRENT_DATE - 1,CURRENT_DATE + 5,$4,$4)`, [id, `P-${index}`, `Proyek ${index}`, adminId]);
    await sandbox.db.query(`INSERT INTO audit_events(id,actor_id,project_id,entity_type,entity_id,action,note)
      VALUES($1,$2,$3,'project',$3,'CREATE_PROJECT',$4)`, [randomUUID(), adminId, id, 'Rahasia internal']);
  }
  await sandbox.db.query(`INSERT INTO project_members(id,project_id,user_id,role_code,start_date,created_by)
    VALUES($1,$2,$3,'TEAM_LEADER',CURRENT_DATE - 1,$4)`, [randomUUID(), ids[0], leader.id, adminId]);
  const app = buildApp({ db: sandbox.db }); t.after(() => app.close());
  const signIn = async (email: string) => {
    const result = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { email, password: secret } });
    return String(result.headers['set-cookie']).split(';')[0];
  };
  const adminCookie = await signIn('admin@example.test'), leaderCookie = await signIn(leader.email), ownerCookie = await signIn(owner.email);
  const fetchActivity = (cookie: string, query = '') => app.inject({ url: `/api/activity${query}`, headers: { cookie } });
  const admin = await fetchActivity(adminCookie); assert.equal(admin.statusCode, 200);
  assert.equal(admin.json().entries.filter((entry: { projectId: string }) => ids.includes(entry.projectId)).length, 2);
  assert.equal(admin.body.includes('Rahasia internal'), false);
  const team = await fetchActivity(leaderCookie); assert.equal(team.statusCode, 200);
  assert.deepEqual(team.json().entries.map((entry: { projectId: string }) => entry.projectId), [ids[0]]);
  assert.equal((await fetchActivity(leaderCookie, `?projectId=${ids[1]}`)).statusCode, 404);
  assert.equal((await fetchActivity(ownerCookie)).statusCode, 403);
  assert.equal((await app.inject({ url: '/api/activity' })).statusCode, 401);
  await sandbox.db.query('UPDATE project_members SET is_active=FALSE WHERE user_id=$1', [leader.id]);
  assert.equal((await fetchActivity(leaderCookie)).json().total, 0);
});
