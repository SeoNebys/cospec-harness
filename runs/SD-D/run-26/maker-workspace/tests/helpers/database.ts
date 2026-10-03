import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase } from '@server/db/database.js';
export function temporaryDatabase() {
  const dir = mkdtempSync(path.join(tmpdir(), 'larder-test-'));
  const db = openDatabase(dir);
  return {
    db,
    dir,
    close() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}
