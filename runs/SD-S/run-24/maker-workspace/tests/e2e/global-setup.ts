import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { closeDatabase, openDatabase } from '../../src/server/db/database.js';

export default function globalSetup() {
  const directory = resolve(process.cwd(), '.tmp');
  mkdirSync(directory, { recursive: true });
  const db = openDatabase({ path: resolve(directory, 'e2e.sqlite') });
  db.prepare('DELETE FROM bookmarks').run();
  db.prepare('DELETE FROM tags').run();
  closeDatabase(db);
}
