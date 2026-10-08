import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { transaction } from '../db/database.js';
import { hashPassword } from '../security/password.js';

const inputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
});

export async function bootstrapAdmin(db: Pool, input: unknown): Promise<'created' | 'exists'> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new Error('Isi nama, email yang valid, dan kata sandi Administrator sepanjang 12–128 karakter.');
  const { name, email, password } = parsed.data;
  const hash = await hashPassword(password);
  return transaction(db, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()), hashtext('bootstrap:' || $1::text))", [email]);
    const existing = (await client.query('SELECT role_code, is_active FROM users WHERE lower(email) = $1', [email])).rows[0];
    if (existing) {
      if (existing.role_code !== 'ADMINISTRATOR' || existing.is_active !== true) {
        throw new Error('Email sudah digunakan akun lain atau akun nonaktif. Bootstrap tidak mengubah akun tersebut.');
      }
      return 'exists';
    }
    const id = randomUUID();
    await client.query(`INSERT INTO users (id, name, email, password_hash, role_code)
      VALUES ($1, $2, $3, $4, 'ADMINISTRATOR')`, [id, name, email, hash]);
    await client.query(`INSERT INTO audit_events (id, actor_id, entity_type, entity_id, action, note)
      VALUES ($1, $2, 'user', $3, 'BOOTSTRAP', 'Administrator awal dibuat melalui konfigurasi lokal.')`, [randomUUID(), id, id]);
    return 'created';
  });
}
