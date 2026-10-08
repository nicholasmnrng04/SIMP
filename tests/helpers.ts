import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { TestContext } from 'node:test';

export function temporaryDirectory(t: TestContext): string {
  const root = path.resolve('.tmp');
  mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(path.join(root, 'simp-test-'));
  t.after(() => {
    if (!path.resolve(directory).startsWith(root + path.sep)) throw new Error('Lokasi pembersihan tidak valid.');
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}
