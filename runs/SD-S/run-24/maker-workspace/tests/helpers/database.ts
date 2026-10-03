import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import {
  closeDatabase,
  openDatabase,
  type BookmarkDatabase,
} from '../../src/server/db/database.js';

export interface TemporaryDatabase {
  db: BookmarkDatabase;
  path: string;
  close: () => void;
}

export function createTemporaryDatabase(): TemporaryDatabase {
  const directory = mkdtempSync(resolve(tmpdir(), 'bookmark-manager-'));
  const path = resolve(directory, 'test.sqlite');
  const db = openDatabase({ path });
  return {
    db,
    path,
    close: () => {
      closeDatabase(db);
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
