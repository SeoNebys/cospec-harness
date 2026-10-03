import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, req } from '../helper.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

test('archive removes from active/unread, appears in archive, restores back', async () => {
  const { body: bm } = await req(srv.base, '/bookmarks', {
    method: 'POST', body: JSON.stringify({ address: 'https://arch.example.com/', title: 'Archive me' }),
  });

  await req(srv.base, `/bookmarks/${bm.id}`, {
    method: 'PATCH', body: JSON.stringify({ isArchived: true }),
  });

  assert.equal((await req(srv.base, '/bookmarks?view=active')).body.length, 0);
  assert.equal((await req(srv.base, '/bookmarks?view=unread')).body.length, 0);
  const archived = await req(srv.base, '/bookmarks?view=archive');
  assert.equal(archived.body.length, 1);
  assert.equal(archived.body[0].id, bm.id);

  // Restore.
  await req(srv.base, `/bookmarks/${bm.id}`, {
    method: 'PATCH', body: JSON.stringify({ isArchived: false }),
  });
  assert.equal((await req(srv.base, '/bookmarks?view=active')).body.length, 1);
  assert.equal((await req(srv.base, '/bookmarks?view=archive')).body.length, 0);
});

test('permanent delete from archive works', async () => {
  const { body: bm } = await req(srv.base, '/bookmarks', {
    method: 'POST', body: JSON.stringify({ address: 'https://arch2.example.com/', title: 'Bye' }),
  });
  await req(srv.base, `/bookmarks/${bm.id}`, {
    method: 'PATCH', body: JSON.stringify({ isArchived: true }),
  });
  const del = await req(srv.base, `/bookmarks/${bm.id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);
  assert.equal((await req(srv.base, '/bookmarks?view=archive')).body.length, 0);
});

test('duplicate save of an archived address reports existingArchived', async () => {
  const { body: bm } = await req(srv.base, '/bookmarks', {
    method: 'POST', body: JSON.stringify({ address: 'https://dup-arch.example.com/', title: 'A' }),
  });
  await req(srv.base, `/bookmarks/${bm.id}`, {
    method: 'PATCH', body: JSON.stringify({ isArchived: true }),
  });
  const dup = await req(srv.base, '/bookmarks', {
    method: 'POST', body: JSON.stringify({ address: 'https://dup-arch.example.com/', title: 'B' }),
  });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.existingId, bm.id);
  assert.equal(dup.body.existingArchived, true);
});
