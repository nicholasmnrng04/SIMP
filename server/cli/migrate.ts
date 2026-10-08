import { readConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
import { migrate } from '../db/migrate.js';

try {
  const config = readConfig();
  const db = openDatabase(config.databaseUrl, config.databaseSchema);
  try { console.log(`Migration selesai: ${await migrate(db)} migration baru diterapkan.`); }
  finally { await db.end(); }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Migration gagal.');
  process.exitCode = 1;
}
