import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPhotoBytes, removePhoto, writePhoto } from '../server/services/photo-files.js';

const id = '11111111-1111-4111-8111-111111111111';

test('foto laporan dan profil tersimpan terpisah di penyimpanan lokal', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'simp-photo-'));
  try {
    const reportPhoto = Buffer.from('foto-laporan');
    const avatar = Buffer.from('foto-profil');
    await writePhoto(directory, id, reportPhoto);
    await writePhoto(directory, id, avatar, 'avatars');
    assert.deepEqual(await readPhotoBytes(directory, id), reportPhoto);
    assert.deepEqual(await readPhotoBytes(directory, id, 'avatars'), avatar);
    await removePhoto(directory, id);
    await assert.rejects(() => readPhotoBytes(directory, id));
    assert.deepEqual(await readPhotoBytes(directory, id, 'avatars'), avatar);
    await removePhoto(directory, id, 'avatars');
    await removePhoto(directory, id, 'avatars');
    await assert.rejects(() => readPhotoBytes(directory, id, 'avatars'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('ID foto yang tidak valid ditolak sebelum mengakses berkas', async () => {
  await assert.rejects(() => readPhotoBytes('storage/uploads', '../foto'));
});
