// Starts the app for end-to-end tests using a throwaway database, so the real
// data/bookmarks.db is never touched.
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { openDatabase } from '../../src/db.js';
import { BookmarkRepository } from '../../src/repository.js';
import { createApp } from '../../src/server.js';

const dir = mkdtempSync(join(tmpdir(), 'bm-e2e-'));
const repo = new BookmarkRepository(openDatabase(join(dir, 'e2e.db')));
const port = Number(process.env.PORT) || 4100;

createApp(repo).listen(port, '127.0.0.1', () => {
  console.log(`E2E server on http://127.0.0.1:${port} (db: ${dir})`);
});
