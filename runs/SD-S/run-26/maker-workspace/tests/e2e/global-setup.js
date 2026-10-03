// Start each e2e run from a clean database.
import fs from 'node:fs';

export default async function globalSetup() {
  const dir = '/tmp/bm-e2e';
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
