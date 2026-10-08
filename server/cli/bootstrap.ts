import { readConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
import { migrate } from '../db/migrate.js';
import { bootstrapAdmin } from '../services/bootstrap-admin.js';

try {
  const config = readConfig();
  const db = openDatabase(config.databaseUrl, config.databaseSchema);
  try {
    await migrate(db);
    const result = await bootstrapAdmin(db, {
      name: process.env.BOOTSTRAP_ADMIN_NAME,
      email: process.env.BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    });
    console.log(result === 'created' ? 'Administrator berhasil dibuat.' : 'Administrator sudah ada; data tidak diubah.');
  } finally { await db.end(); }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Bootstrap gagal.');
  process.exitCode = 1;
}
