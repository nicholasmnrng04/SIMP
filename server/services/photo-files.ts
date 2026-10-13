import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

function fileName(id: string, namespace: '' | 'avatars' = ''): string {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('ID foto tidak valid.');
  return `${namespace ? `${namespace}/` : ''}${id}.jpg`;
}

export async function writePhoto(directory: string, id: string, bytes: Buffer, namespace: '' | 'avatars' = ''): Promise<void> {
  const name = fileName(id, namespace);
  await mkdir(join(directory, namespace), { recursive: true });
  await writeFile(join(resolve(directory), name), bytes, { flag: 'wx' });
}

export async function readPhotoBytes(directory: string, id: string, namespace: '' | 'avatars' = ''): Promise<Buffer> {
  return readFile(join(resolve(directory), fileName(id, namespace)));
}

export async function removePhoto(directory: string, id: string, namespace: '' | 'avatars' = ''): Promise<void> {
  try { await unlink(join(resolve(directory), fileName(id, namespace))); }
  catch (error) { if (!(typeof error === 'object' && error && 'code' in error && error.code === 'ENOENT')) throw error; }
}
