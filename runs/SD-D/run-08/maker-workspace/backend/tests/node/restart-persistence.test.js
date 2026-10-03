// Persistence-across-restart test (SC-007, FR-043). Seeds data, fully stops the
// server process, starts it again against the same data directory, and asserts that
// bookmarks, tags, notes, read/archive states, saved views, snapshots, and
// preferences all survive an actual restart (not just a page reload).
//
// Run: node tests/node/restart-persistence.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(__dirname, '../../src/server.js');
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-restart-'));
const PORT = 4123;
const BASE = `http://127.0.0.1:${PORT}`;

function startServer() {
  const child = spawn('node', [SERVER], {
    env: { ...process.env, PORT: String(PORT), BOOKMARKS_DATA_DIR: DATA_DIR, BOOKMARKS_DISABLE_JOBS: '1' },
    stdio: 'ignore',
  });
  return child;
}

async function waitReady(timeoutMs = 15000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(`${BASE}/api/preferences`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() - start > timeoutMs) throw new Error('server did not start');
    await new Promise((r) => setTimeout(r, 200));
  }
}

function stopServer(child) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    child.on('exit', finish);
    child.kill('SIGTERM');
    // Fallback: force-kill if it does not exit promptly.
    setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
      finish();
    }, 4000);
  });
}

const j = (p, opts) => fetch(`${BASE}${p}`, opts).then((r) => r.json());

test('data survives an actual server restart', async () => {
  // --- First run: seed data ---
  let server = startServer();
  await waitReady();

  const bm = await j('/api/bookmarks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/persist', title: 'Persisted', tags: ['keep', 'work'] }),
  });
  assert.ok(bm.id, 'bookmark created');

  await j(`/api/bookmarks/${bm.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ note: '# My note\n\nremember this' }),
  });
  await j(`/api/bookmarks/${bm.id}/read-state`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ unread: true }),
  });

  // A second bookmark that we archive.
  const bm2 = await j('/api/bookmarks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.org/archived', title: 'Archived one' }),
  });
  await fetch(`${BASE}/api/bookmarks/${bm2.id}/archive`, { method: 'POST' });

  await j('/api/views', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Keepers', query: 'persist', includeTags: ['keep'] }),
  });
  await j('/api/preferences', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ defaultSort: 'title_asc', itemsPerPage: 42, fontSize: 'large' }),
  });

  // Record the snapshot state (jobs are disabled in this test, so it stays 'pending').
  const beforeSnap = (await j(`/api/bookmarks/${bm.id}`)).snapshot.status;

  // --- Restart: fully stop and start the process again ---
  await stopServer(server);
  server = startServer();
  await waitReady();

  // --- Assertions after restart ---
  const active = await j('/api/bookmarks');
  assert.equal(active.total, 1, 'one active bookmark survived');
  const survived = active.items[0];
  assert.equal(survived.title, 'Persisted');
  assert.deepEqual([...survived.tags].sort(), ['keep', 'work']);
  assert.match(survived.note, /remember this/, 'note survived');
  assert.ok(survived.noteHtml.includes('<h1'), 'note renders as markdown');
  assert.equal(survived.isUnread, true, 'read-later state survived');
  assert.equal(survived.snapshot.status, beforeSnap, 'snapshot state survived');

  const archived = await j('/api/bookmarks/archived');
  assert.equal(archived.total, 1, 'archived bookmark survived in archive');

  const views = await j('/api/views');
  assert.equal(views.length, 1, 'saved view survived');
  assert.equal(views[0].name, 'Keepers');

  const prefs = await j('/api/preferences');
  assert.deepEqual(prefs, { defaultSort: 'title_asc', itemsPerPage: 42, fontSize: 'large' });

  await stopServer(server);
});
