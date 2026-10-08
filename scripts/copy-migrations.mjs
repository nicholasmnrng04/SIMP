import { cpSync } from 'node:fs';
cpSync('server/db/migrations/postgresql', 'dist/server/db/migrations/postgresql', { recursive: true });
cpSync('server/templates', 'dist/server/templates', { recursive: true });
