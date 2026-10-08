import pg from 'pg';
import type { Pool, PoolClient } from 'pg';

// DATE adalah tanggal bisnis, bukan timestamp yang dikonversi zona waktu.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export function openDatabase(connectionString: string, schema = 'public'): Pool {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) throw new Error('Nama schema database tidak valid.');
  const caBase64 = process.env.DATABASE_CA_BASE64;
  let poolUrl = connectionString;
  let ssl: { ca: string; rejectUnauthorized: true } | undefined;
  if (caBase64) {
    const ca = Buffer.from(caBase64, 'base64').toString('utf8');
    if (!ca.includes('-----BEGIN CERTIFICATE-----')) throw new Error('Sertifikat CA database tidak valid.');
    const parsed = new URL(connectionString);
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('sslrootcert');
    poolUrl = parsed.toString();
    ssl = { ca, rejectUnauthorized: true };
  }
  const pool = new pg.Pool({
    connectionString: poolUrl, ...(ssl ? { ssl } : {}),
    max: process.env.VERCEL ? 1 : 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000,
    statement_timeout: 15000, options: `-c search_path=${schema} -c timezone=UTC`,
    application_name: 'simp-prototype',
  });
  pool.on('error', () => {
    console.error('Koneksi PostgreSQL yang sedang tidak digunakan terputus. Permintaan berikutnya akan membuka koneksi baru.');
  });
  return pool;
}

export async function transaction<T>(db: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    throw error;
  } finally {
    client.release(discard);
  }
}
