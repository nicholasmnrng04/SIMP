import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { transaction } from './database.js';

export const migrationsDirectory = join(import.meta.dirname, 'migrations', 'postgresql');

export async function migrate(db: Pool, directory = migrationsDirectory): Promise<number> {
  return transaction(db, async (client) => {
    const schema = (await client.query('SELECT current_schema() AS name')).rows[0]?.name;
    if (!schema) throw new Error('Schema PostgreSQL belum tersedia. Periksa DATABASE_SCHEMA.');
    await client.query("SELECT pg_advisory_xact_lock(hashtext(current_database()), hashtext(current_schema() || ':simp:migrations'))");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY, checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const files = readdirSync(directory).filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/.test(file)).sort();
    const applied = (await client.query<{ name: string; checksum: string }>('SELECT name, checksum FROM schema_migrations')).rows;
    for (const row of applied) {
      if (!files.includes(String(row.name))) throw new Error(`Migration yang telah diterapkan hilang: ${row.name}`);
    }
    let count = 0;
    for (const name of files) {
      const sql = readFileSync(join(directory, name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = applied.find((row) => row.name === name);
      if (previous) {
        if (previous.checksum !== checksum) throw new Error(`Migration ${name} berubah. Buat migration baru.`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
      count++;
    }
    return count;
  });
}
