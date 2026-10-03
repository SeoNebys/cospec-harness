import { rmSync } from 'node:fs';

// Start each E2E run from a clean database.
export default function globalSetup() {
  const dir = process.env.E2E_DATA_DIR || '/tmp/bm-e2e-data';
  rmSync(dir, { recursive: true, force: true });
}
