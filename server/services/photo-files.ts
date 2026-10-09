import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { AppError } from '../errors.js';

function fileName(id: string, namespace: '' | 'avatars' = ''): string {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('ID foto tidak valid.');
  return `${namespace ? `${namespace}/` : ''}${id}.jpg`;
}

function remoteConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!url && !key && !bucket) return null;
  if (!url || !key || !bucket) throw new Error('Konfigurasi Supabase Storage belum lengkap.');
  const origin = new URL(url);
  if (origin.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(origin.hostname)
    || origin.pathname !== '/' || !/^[a-z0-9-]+$/.test(bucket)) {
    throw new Error('Konfigurasi Supabase Storage tidak valid.');
  }
  const base = `${origin.origin}/storage/v1/object`;
  // Kunci baru sb_secret_* bukan JWT dan harus dikirim melalui apikey.
  const headers = key.startsWith('sb_secret_')
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` };
  return { base, bucket, headers };
}

export function assertPhotoStorageReady(): void {
  if (!process.env.VERCEL) return;
  const remote = remoteConfig();
  if (!remote) throw new Error('Supabase Storage wajib dikonfigurasi di Vercel.');
  const storageRef = new URL(process.env.SUPABASE_URL!).hostname.split('.')[0];
  const database = new URL(process.env.DATABASE_URL ?? '');
  const databaseRef = database.hostname.startsWith('db.')
    ? database.hostname.split('.')[1]
    : decodeURIComponent(database.username).split('.')[1];
  if (!databaseRef || storageRef !== databaseRef) {
    throw new Error('Database dan Storage harus berasal dari proyek Supabase yang sama.');
  }
}

export async function writePhoto(directory: string, id: string, bytes: Buffer, namespace: '' | 'avatars' = ''): Promise<void> {
  const name = fileName(id, namespace);
  const remote = remoteConfig();
  if (!remote) {
    await mkdir(join(directory, namespace), { recursive: true });
    await writeFile(join(resolve(directory), name), bytes, { flag: 'wx' });
    return;
  }
  let response: Response;
  try {
    response = await fetch(`${remote.base}/${remote.bucket}/${name}`, {
      method: 'POST', headers: { ...remote.headers, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
      body: new Uint8Array(bytes), signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new AppError(503, 'PHOTO_STORAGE_NETWORK', 'Penyimpanan foto belum tersedia. Silakan coba kembali.');
  }
  if (!response.ok) {
    throw new AppError(503, `PHOTO_STORAGE_${response.status}`, 'Penyimpanan foto belum tersedia. Silakan coba kembali.');
  }
}

export async function readPhotoBytes(directory: string, id: string, namespace: '' | 'avatars' = ''): Promise<Buffer> {
  const name = fileName(id, namespace);
  const remote = remoteConfig();
  if (!remote) return readFile(join(resolve(directory), name));
  const response = await fetch(`${remote.base}/authenticated/${remote.bucket}/${name}`, {
    headers: remote.headers, signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Pembacaan foto gagal (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

export async function removePhoto(directory: string, id: string, namespace: '' | 'avatars' = ''): Promise<void> {
  const name = fileName(id, namespace);
  const remote = remoteConfig();
  if (!remote) {
    try { await unlink(join(resolve(directory), name)); }
    catch (error) { if (!(typeof error === 'object' && error && 'code' in error && error.code === 'ENOENT')) throw error; }
    return;
  }
  const response = await fetch(`${remote.base}/${remote.bucket}/${name}`, {
    method: 'DELETE', headers: remote.headers, signal: AbortSignal.timeout(30000),
  });
  if (!response.ok && response.status !== 404) throw new Error(`Penghapusan foto gagal (${response.status}).`);
}
