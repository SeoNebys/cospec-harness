import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../src/server/db/connection';
import { migrate } from '../../src/server/db/migrate';

export function temporaryDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'pinboard-test-'));
  const db = openDatabase(join(directory, 'test.sqlite'));
  migrate(db);
  return {
    db,
    directory,
    close: () => {
      if (db.open) db.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
