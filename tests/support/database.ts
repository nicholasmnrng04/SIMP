import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { readConfig } from '../../server/config.js';
import { openDatabase } from '../../server/db/database.js';

// Setiap tes hanya dapat menghapus schema acak yang dibuat oleh helper ini.
export async function createTestDatabase(): Promise<{ db: Pool; schema: string; close: () => Promise<void> }> {
  const config = readConfig();
  const manager = openDatabase(config.databaseUrl);
  const schema = 'simp_test_' + randomBytes(16).toString('hex');
  try { await manager.query(`CREATE SCHEMA "${schema}"`); }
  catch (error) { await manager.end(); throw error; }
  const db = openDatabase(config.databaseUrl, schema);
  return { db, schema, close: async () => {
    if (!db.ended) await db.end();
    if (!/^simp_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Schema pembersihan tes tidak valid.');
    try { await manager.query(`DROP SCHEMA "${schema}" CASCADE`); }
    finally { await manager.end(); }
  } };
}
