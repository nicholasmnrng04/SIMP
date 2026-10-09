import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPhotoBytes, removePhoto, writePhoto } from '../server/services/photo-files.js';

const id = '11111111-1111-4111-8111-111111111111';

test('foto lokal tetap dapat ditulis, dibaca, dan dihapus', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'simp-photo-'));
  try {
    const bytes = Buffer.from('foto-uji');
    await writePhoto(directory, id, bytes);
    assert.deepEqual(await readPhotoBytes(directory, id), bytes);
    await removePhoto(directory, id);
    await assert.rejects(() => readPhotoBytes(directory, id));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('foto privat memakai Storage server-side dan tidak mengungkap secret ke URL', async () => {
  const previous = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY,
    bucket: process.env.SUPABASE_STORAGE_BUCKET,
  };
  process.env.SUPABASE_URL = 'https://contoh.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_kunci-uji';
  process.env.SUPABASE_STORAGE_BUCKET = 'simp-report-photos';
  const calls: Array<{ url: string; method: string; authorization: string; apikey: string }> = [];
  const fetchMock = mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls.push({
      url: String(input), method: init?.method ?? 'GET',
      authorization: new Headers(init?.headers).get('authorization') ?? '',
      apikey: new Headers(init?.headers).get('apikey') ?? '',
    });
    if (init?.method === 'POST') return new Response('{}', { status: 200 });
    if (init?.method === 'DELETE') return new Response('{}', { status: 200 });
    return new Response(Buffer.from('foto-uji'), { status: 200 });
  });
  try {
    await writePhoto('tidak-dipakai', id, Buffer.from('foto-uji'));
    assert.deepEqual(await readPhotoBytes('tidak-dipakai', id), Buffer.from('foto-uji'));
    await removePhoto('tidak-dipakai', id);
    assert.deepEqual(calls.map(call => call.method), ['POST', 'GET', 'DELETE']);
    assert.ok(calls[1].url.includes('/storage/v1/object/authenticated/simp-report-photos/'));
    assert.ok(calls.every(call => call.apikey === 'sb_secret_kunci-uji'
      && call.authorization === '' && !call.url.includes('kunci-uji')));
  } finally {
    fetchMock.mock.restore();
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = previous.key;
    if (previous.bucket === undefined) delete process.env.SUPABASE_STORAGE_BUCKET; else process.env.SUPABASE_STORAGE_BUCKET = previous.bucket;
  }
});

test('kegagalan unggah Storage memberi kode aman tanpa mengungkap secret', async () => {
  const previous = [process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_STORAGE_BUCKET];
  process.env.SUPABASE_URL = 'https://contoh.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_kunci-uji';
  process.env.SUPABASE_STORAGE_BUCKET = 'simp-report-photos';
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response('private error', { status: 403 }));
  try {
    await assert.rejects(() => writePhoto('tidak-dipakai', id, Buffer.from('foto-uji')), error => {
      assert.equal((error as { code?: string }).code, 'PHOTO_STORAGE_403');
      assert.ok(!String(error).includes('kunci-uji'));
      assert.ok(!String(error).includes('private error'));
      return true;
    });
  } finally {
    fetchMock.mock.restore();
    for (const [name, value] of [
      ['SUPABASE_URL', previous[0]], ['SUPABASE_SECRET_KEY', previous[1]], ['SUPABASE_STORAGE_BUCKET', previous[2]],
    ] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
