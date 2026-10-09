import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import sharp from 'sharp';
import { profileNameSchema, profilePasswordSchema, profilePhotoSchema } from '../../shared/validation.js';
import { transaction } from '../db/database.js';
import { AppError } from '../errors.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import { readPhotoBytes, removePhoto, writePhoto } from './photo-files.js';

async function audit(client: import('pg').PoolClient, id: string, action: string) {
  await client.query(`INSERT INTO audit_events(id,actor_id,entity_type,entity_id,action,note)
    VALUES ($1,$2,'user',$2,$3,'')`, [randomUUID(), id, action]);
}

export async function updateOwnName(db: Pool, actorId: string, input: unknown): Promise<void> {
  const { name } = profileNameSchema.parse(input);
  await transaction(db, async client => {
    const row = await client.query('UPDATE users SET name=$2,updated_at=CURRENT_TIMESTAMP,updated_by=$1 WHERE id=$1 AND is_active RETURNING id', [actorId, name]);
    if (!row.rowCount) throw new AppError(401, 'UNAUTHENTICATED', 'Sesi Anda berakhir. Silakan masuk kembali.');
    await audit(client, actorId, 'UPDATE_OWN_NAME');
  });
}

export async function changeOwnPassword(db: Pool, actorId: string, input: unknown): Promise<void> {
  const { currentPassword, newPassword } = profilePasswordSchema.parse(input);
  if (currentPassword === newPassword) throw new AppError(400, 'SAME_PASSWORD', 'Kata sandi baru harus berbeda dari kata sandi saat ini.');
  const hash = await hashPassword(newPassword);
  await transaction(db, async client => {
    const row = (await client.query('SELECT password_hash FROM users WHERE id=$1 AND is_active FOR UPDATE', [actorId])).rows[0];
    if (!row) throw new AppError(401, 'UNAUTHENTICATED', 'Sesi Anda berakhir. Silakan masuk kembali.');
    if (!(await verifyPassword(currentPassword, row.password_hash))) {
      throw new AppError(400, 'WRONG_PASSWORD', 'Kata sandi saat ini tidak sesuai.');
    }
    await client.query('UPDATE users SET password_hash=$2,updated_at=CURRENT_TIMESTAMP,updated_by=$1 WHERE id=$1', [actorId, hash]);
    await client.query('DELETE FROM sessions WHERE user_id=$1', [actorId]);
    await audit(client, actorId, 'CHANGE_OWN_PASSWORD');
  });
}

function decodeProfilePhoto(input: unknown): { mime: string; bytes: Buffer } {
  const { mime, data } = profilePhotoSchema.parse(input);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) {
    throw new AppError(400, 'INVALID_PHOTO', 'Berkas foto tidak valid.');
  }
  const bytes = Buffer.from(data, 'base64');
  if (!bytes.length || bytes.length > 1024 * 1024) throw new AppError(413, 'PHOTO_TOO_LARGE', 'Foto profil maksimal 1 MiB.');
  return { mime, bytes };
}

export async function uploadOwnPhoto(db: Pool, directory: string, actorId: string, input: unknown): Promise<void> {
  const { mime, bytes } = decodeProfilePhoto(input);
  let output: Buffer;
  try {
    const image = sharp(bytes, { limitInputPixels: 12_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    if ((mime === 'image/png' && metadata.format !== 'png') || (mime === 'image/jpeg' && metadata.format !== 'jpeg')) {
      throw new Error('format');
    }
    output = await image.rotate().resize(320, 320, { fit: 'cover', position: 'centre' }).jpeg({ quality: 82 }).toBuffer();
  } catch { throw new AppError(400, 'INVALID_PHOTO', 'Gunakan foto JPEG atau PNG yang valid.'); }
  const id = randomUUID();
  await writePhoto(directory, id, output, 'avatars');
  let previous: string | null = null;
  try {
    await transaction(db, async client => {
      const row = (await client.query('SELECT avatar_photo_id FROM users WHERE id=$1 AND is_active FOR UPDATE', [actorId])).rows[0];
      if (!row) throw new AppError(401, 'UNAUTHENTICATED', 'Sesi Anda berakhir. Silakan masuk kembali.');
      previous = row.avatar_photo_id;
      await client.query('UPDATE users SET avatar_photo_id=$2,updated_at=CURRENT_TIMESTAMP,updated_by=$1 WHERE id=$1', [actorId, id]);
      await audit(client, actorId, 'UPLOAD_OWN_AVATAR');
    });
  } catch (error) { await removePhoto(directory, id, 'avatars').catch(() => {}); throw error; }
  if (previous) await removePhoto(directory, previous, 'avatars').catch(() => {});
}

export async function ownPhoto(db: Pool, directory: string, actorId: string): Promise<Buffer> {
  const row = (await db.query('SELECT avatar_photo_id FROM users WHERE id=$1 AND is_active', [actorId])).rows[0];
  if (!row?.avatar_photo_id) throw new AppError(404, 'PHOTO_NOT_FOUND', 'Foto profil belum tersedia.');
  try { return await readPhotoBytes(directory, row.avatar_photo_id, 'avatars'); }
  catch { throw new AppError(404, 'PHOTO_NOT_FOUND', 'Foto profil belum tersedia.'); }
}

export async function deleteOwnPhoto(db: Pool, directory: string, actorId: string): Promise<void> {
  let previous: string | null = null;
  await transaction(db, async client => {
    const row = (await client.query('SELECT avatar_photo_id FROM users WHERE id=$1 AND is_active FOR UPDATE', [actorId])).rows[0];
    if (!row) throw new AppError(401, 'UNAUTHENTICATED', 'Sesi Anda berakhir. Silakan masuk kembali.');
    previous = row.avatar_photo_id;
    if (!previous) return;
    await client.query('UPDATE users SET avatar_photo_id=NULL,updated_at=CURRENT_TIMESTAMP,updated_by=$1 WHERE id=$1', [actorId]);
    await audit(client, actorId, 'DELETE_OWN_AVATAR');
  });
  if (previous) await removePhoto(directory, previous, 'avatars').catch(() => {});
}
