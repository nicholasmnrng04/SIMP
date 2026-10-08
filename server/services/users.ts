import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { ManagedUser } from '../../shared/contracts.js';
import { createUserSchema, updateUserSchema } from '../../shared/validation.js';
import { transaction } from '../db/database.js';
import { AppError } from '../errors.js';
import { hashPassword } from '../security/password.js';

const safeColumns = 'id, name, email, role_code AS role, is_active AS "isActive", created_at AS "createdAt"';
async function checkAdministrator(client: PoolClient, actorId: string) {
  const actor = (await client.query('SELECT role_code, is_active FROM users WHERE id = $1 FOR SHARE', [actorId])).rows[0];
  if (!actor?.is_active || actor.role_code !== 'ADMINISTRATOR') throw new AppError(403, 'FORBIDDEN', 'Anda tidak memiliki akses untuk mengelola pengguna.');
}
async function audit(client: PoolClient, actorId: string, userId: string, action: string, note: string) {
  await client.query(`INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, note)
    VALUES ($1, $2, 'user', $3, $4, $5)`, [randomUUID(), actorId, userId, action, note]);
}
function translateConflict(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    throw new AppError(409, 'EMAIL_EXISTS', 'Email sudah digunakan. Gunakan alamat email lain.');
  }
  throw error;
}

export async function listUsers(db: Pool, actorId: string): Promise<ManagedUser[]> {
  return transaction(db, async (client) => {
    await checkAdministrator(client, actorId);
    return (await client.query<ManagedUser>(`SELECT ${safeColumns} FROM users ORDER BY lower(name), id`)).rows;
  });
}

export async function createUser(db: Pool, actorId: string, input: unknown): Promise<ManagedUser> {
  const data = createUserSchema.parse(input);
  const hash = await hashPassword(data.password);
  try {
    return await transaction(db, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()), hashtext('simp:users'))");
      await checkAdministrator(client, actorId);
      const id = randomUUID();
      const result = await client.query<ManagedUser>(`INSERT INTO users (id, name, email, role_code, is_active, password_hash, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING ${safeColumns}`, [id, data.name, data.email, data.role, data.isActive, hash, actorId]);
      await audit(client, actorId, id, 'CREATE_USER', `Pengguna dibuat dengan role ${data.role}; status ${data.isActive ? 'aktif' : 'nonaktif'}.`);
      return result.rows[0];
    });
  } catch (error) { translateConflict(error); }
}

export async function updateUser(db: Pool, actorId: string, id: string, input: unknown): Promise<ManagedUser> {
  const data = updateUserSchema.parse(input);
  const hash = data.password ? await hashPassword(data.password) : null;
  try {
    return await transaction(db, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()), hashtext('simp:users'))");
      await checkAdministrator(client, actorId);
      const old = (await client.query('SELECT role_code, is_active FROM users WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!old) throw new AppError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
      if (old.role_code === 'ADMINISTRATOR' && old.is_active && (data.role !== 'ADMINISTRATOR' || !data.isActive)) {
        const count = (await client.query("SELECT COUNT(*)::int AS count FROM users WHERE role_code = 'ADMINISTRATOR' AND is_active = TRUE")).rows[0].count;
        if (count <= 1) throw new AppError(409, 'LAST_ADMIN', 'Sisakan minimal satu Administrator aktif agar aplikasi tetap dapat dikelola.');
      }
      const result = await client.query<ManagedUser>(`UPDATE users SET name = $2, email = $3, role_code = $4, is_active = $5,
        password_hash = COALESCE($6, password_hash), updated_by = $7, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 RETURNING ${safeColumns}`, [id, data.name, data.email, data.role, data.isActive, hash, actorId]);
      if (old.role_code !== data.role || old.is_active !== data.isActive || hash) {
        await client.query('DELETE FROM sessions WHERE user_id = $1', [id]);
      }
      await audit(client, actorId, id, 'UPDATE_USER', `Data pengguna diperbarui. Role ${old.role_code} menjadi ${data.role}; status ${data.isActive ? 'aktif' : 'nonaktif'}${hash ? '; kata sandi diganti' : ''}.`);
      return result.rows[0];
    });
  } catch (error) { translateConflict(error); }
}
