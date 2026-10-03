import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const port = 43871;
const origin = `http://127.0.0.1:${port}`;
let directory;
let processHandle;

async function waitUntilReady() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/bookmarks`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Test server did not start');
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'tuck-api-'));
  processHandle = spawn(process.execPath, ['implementation/server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', TUCK_DATA_FILE: join(directory, 'bookmarks.json') },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitUntilReady();
});

after(async () => {
  processHandle?.kill('SIGTERM');
  await rm(directory, { recursive: true, force: true });
});

async function json(path, options) {
  const response = await fetch(`${origin}${path}`, options);
  return { response, payload: await response.json() };
}

test('approved bookmark lifecycle is available through the application API', async () => {
  const invalid = await json('/api/bookmarks', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'bad address' })
  });
  assert.equal(invalid.response.status, 422);

  const saved = await json('/api/bookmarks', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      url: 'https://example.com/', title: 'Example Domain', description: 'Example description', tags: ['Reading', 'WORK', 'reading']
    })
  });
  assert.equal(saved.response.status, 201);
  assert.deepEqual(saved.payload.bookmark.tags, ['reading', 'work']);

  const duplicate = await json('/api/bookmarks', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com/#about' })
  });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.payload.bookmark.id, saved.payload.bookmark.id);

  const tags = await json('/api/tags?q=READ');
  assert.deepEqual(tags.payload.tags, [{ name: 'reading', uses: 1 }]);

  const updated = await json(`/api/bookmarks/${saved.payload.bookmark.id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'My example' })
  });
  assert.equal(updated.payload.bookmark.title, 'My example');

  const removed = await json(`/api/bookmarks/${saved.payload.bookmark.id}`, { method: 'DELETE' });
  assert.equal(removed.payload.undoWindowMs, 8000);
  assert.equal((await json('/api/bookmarks')).payload.bookmarks.length, 0);

  const restored = await json(`/api/bookmarks/${saved.payload.bookmark.id}/restore`, { method: 'POST' });
  assert.equal(restored.response.status, 200);
  assert.equal((await json('/api/bookmarks')).payload.bookmarks.length, 1);
});
