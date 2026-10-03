import request from 'supertest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// One shared database is reused across API test files and reset in place. This
// keeps the number of native better-sqlite3 open/close cycles low (which is what
// makes the addon's teardown finalizer flaky under the test runner).
let sharedDir;

function ensureSharedEnv() {
  if (!sharedDir) sharedDir = mkdtempSync(join(tmpdir(), 'bm-shared-'));
  process.env.BOOKMARKS_DB = join(sharedDir, 'shared.db');
  process.env.SNAPSHOT_DIR = join(sharedDir, 'snapshots');
}

export async function freshAgent() {
  ensureSharedEnv();
  const conn = await import('../../src/server/db/connection.js');
  // Reopen only if the connection isn't already the shared DB (another test file
  // may have pointed it elsewhere).
  if (conn.activeDbPath() !== resolve(process.env.BOOKMARKS_DB)) {
    conn.reopenDb();
  } else {
    conn.getDb();
  }
  const db = conn.getDb();
  db.exec(
    'DELETE FROM bookmark_tags; DELETE FROM tags; DELETE FROM bookmarks; DELETE FROM saved_filters;'
  );
  db.prepare(
    'UPDATE display_preferences SET defaultSort = ?, itemsPerPage = ?, fontSize = ? WHERE id = 1'
  ).run('dateAdded_desc', 25, 'medium');

  const { createApp } = await import('../../src/server/app.js');
  return request(createApp());
}

// A canned HTML fetch stub for preview/metadata tests.
export function stubHtmlFetch(html, { contentType = 'text/html' } = {}) {
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: () => contentType },
    text: async () => html,
  });
}
