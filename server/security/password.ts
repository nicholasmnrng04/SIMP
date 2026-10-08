import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 65536, r = 8, p = 1, keyLength = 64;
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, { N, r, p, maxmem: 128 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error); else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return ['scrypt', N, r, p, salt.toString('hex'), hash.toString('hex')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, block, parallel, salt, hash, ...extra] = stored.split('$');
  if (algorithm !== 'scrypt' || n !== String(N) || block !== String(r) || parallel !== String(p)
      || !salt || !hash || extra.length || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const candidate = await derive(password, Buffer.from(salt, 'hex'));
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}
