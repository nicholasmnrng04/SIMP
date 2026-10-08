import { readFileSync, writeFileSync } from 'node:fs';

const path = '.env.demo';
const keys = new Set([
  'BOOTSTRAP_ADMIN_NAME',
  'BOOTSTRAP_ADMIN_EMAIL',
  'BOOTSTRAP_ADMIN_PASSWORD',
]);
const content = readFileSync(path, 'utf8');
const lines = content.split(/\r?\n/);
const found = new Set();
const cleared = lines.map((line) => {
  const key = line.slice(0, line.indexOf('='));
  if (!keys.has(key)) return line;
  found.add(key);
  return `${key}=`;
});
if (found.size !== keys.size) {
  console.error('Isian bootstrap Administrator tidak lengkap; file tidak diubah.');
  process.exitCode = 1;
} else {
  writeFileSync(path, cleared.join(content.includes('\r\n') ? '\r\n' : '\n'));
  console.log('Isian bootstrap Administrator telah dikosongkan dari .env.demo. Akun database tetap ada.');
}
