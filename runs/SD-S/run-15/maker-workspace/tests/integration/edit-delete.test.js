import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, req } from '../helper.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

async function create(address, title) {
  const { body } = await req(srv.base, '/bookmarks', {
    method: 'POST', body: JSON.stringify({ address, title }),
  });
  return body;
}

test('PATCH updates address, title, description and tags', async () => {
  const bm = await create('https://edit.example.com/', 'Before');
  const { status, body } = await req(srv.base, `/bookmarks/${bm.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      address: 'https://edited.example.com/new',
      title: 'After',
      description: 'updated',
      tags: ['a', 'b'],
    }),
  });
  assert.equal(status, 200);
  assert.equal(body.address, 'https://edited.example.com/new');
  assert.equal(body.title, 'After');
  assert.equal(body.description, 'updated');
  assert.deepEqual(body.tags, ['a', 'b']);
});

test('PATCH address to an existing one returns 409 with existingId', async () => {
  const a = await create('https://one.example.com/', 'One');
  const b = await create('https://two.example.com/', 'Two');
  const { status, body } = await req(srv.base, `/bookmarks/${b.id}`, {
    method: 'PATCH', body: JSON.stringify({ address: 'https://one.example.com/' }),
  });
  assert.equal(status, 409);
  assert.equal(body.existingId, a.id);
});

test('DELETE removes permanently', async () => {
  const bm = await create('https://gone.example.com/', 'Gone');
  const del = await req(srv.base, `/bookmarks/${bm.id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);
  const get = await req(srv.base, `/bookmarks/${bm.id}`);
  assert.equal(get.status, 404);
});
