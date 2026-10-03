import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

async function startServer() {
  const directory = await mkdtemp(join(tmpdir(), 'keepwell-api-')); const port = 4700 + Math.floor(Math.random() * 200);
  const child = spawn(process.execPath, ['implementation/server.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', KEEPWELL_DATA: join(directory, 'data.json') }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server start timeout')), 5000); child.stdout.on('data', chunk => { if (chunk.toString().includes('Keepwell listening')) { clearTimeout(timer); resolve(); } }); child.once('exit', code => reject(new Error(`server exited ${code}`))); });
  return { child, base: `http://127.0.0.1:${port}` };
}

test('bookmark API creates, rejects duplicate copies, and updates status', async t => {
  const { child, base } = await startServer(); t.after(() => child.kill('SIGTERM'));
  const create = await fetch(`${base}/api/bookmarks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com/guide', title: 'Guide', tags: ['Work'], notes: 'Read chapter two' }) });
  assert.equal(create.status, 201); const created = await create.json();
  const duplicate = await fetch(`${base}/api/bookmarks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://EXAMPLE.com/guide#part', title: 'Copy' }) });
  assert.equal(duplicate.status, 200); assert.equal((await duplicate.json()).duplicate, true);
  const patch = await fetch(`${base}/api/bookmarks/${created.bookmark.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ readLater: true, archived: true }) });
  const updated = await patch.json(); assert.equal(updated.bookmark.readLater, true); assert.equal(updated.bookmark.archived, true); assert.equal(updated.bookmark.notes, 'Read chapter two');
  const list = await (await fetch(`${base}/api/bookmarks`)).json(); assert.equal(list.bookmarks.length, 1);
});

test('metadata API rejects malformed input without storing anything', async t => {
  const { child, base } = await startServer(); t.after(() => child.kill('SIGTERM'));
  const response = await fetch(`${base}/api/metadata`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'not a link' }) });
  assert.equal(response.status, 400); assert.match((await response.json()).error, /web address/);
  const list = await (await fetch(`${base}/api/bookmarks`)).json(); assert.equal(list.bookmarks.length, 0);
});
