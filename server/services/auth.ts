import { createHash, randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import type { SessionUser } from '../../shared/contracts.js';
import { loginSchema } from '../../shared/validation.js';
import { transaction } from '../db/database.js';
import { AppError } from '../errors.js';
import { verifyPassword } from '../security/password.js';

export const sessionCookieName = 'simp_session';
export const sessionSeconds = 8 * 60 * 60;
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const dummyHash = ['scrypt', 65536, 8, 1, '0'.repeat(32), '0'.repeat(128)].join('$');
const invalidLogin = () => new AppError(401, 'INVALID_CREDENTIALS', 'Email atau kata sandi tidak sesuai, atau akun tidak aktif.');

export async function login(db: Pool, input: unknown, previousToken?: string) {
  const { email, password } = loginSchema.parse(input);
  const initial = (await db.query('SELECT id, password_hash, is_active FROM users WHERE lower(email) = $1', [email])).rows[0];
  const valid = await verifyPassword(password, initial?.password_hash ?? dummyHash);
  if (!initial || !valid || !initial.is_active) throw invalidLogin();
  return transaction(db, async (client) => {
    // Periksa ulang setelah hashing: password/role/status mungkin diubah sementara itu.
    const current = (await client.query('SELECT id, name, email, role_code AS role, password_hash, is_active FROM users WHERE id = $1 FOR UPDATE', [initial.id])).rows[0];
    if (!current?.is_active || current.password_hash !== initial.password_hash) throw invalidLogin();
    if (previousToken) await client.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(previousToken)]);
    await client.query('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP');
    const token = randomBytes(32).toString('hex');
    await client.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '8 hours')", [tokenHash(token), current.id]);
    const user: SessionUser = { id: current.id, name: current.name, email: current.email, role: current.role };
    return { token, user };
  });
}

export async function sessionUser(db: Pool, token?: string): Promise<SessionUser | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const result = await db.query<SessionUser>(`SELECT u.id, u.name, u.email, u.role_code AS role
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = TRUE`, [tokenHash(token)]);
  return result.rows[0] ?? null;
}

export async function logout(db: Pool, token?: string) {
  if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)]);
}
