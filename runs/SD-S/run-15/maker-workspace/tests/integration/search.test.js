import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, req } from '../helper.js';

let srv;
after(async () => { await srv.close(); });

before(async () => {
  srv = await startTestServer();
  await req(srv.base, '/bookmarks', {
    method: 'POST',
    body: JSON.stringify({
      address: 'https://nodejs.org/', title: 'Node.js Docs',
      description: 'server runtime', tags: ['tech', 'reference'],
    }),
  });
  await req(srv.base, '/bookmarks', {
    method: 'POST',
    body: JSON.stringify({
      address: 'https://cooking.example.com/', title: 'Pasta recipe',
      description: 'dinner ideas', tags: ['food'],
    }),
  });
});

test('keyword matches title', async () => {
  const { body } = await req(srv.base, '/bookmarks?q=pasta');
  assert.equal(body.length, 1);
  assert.equal(body[0].title, 'Pasta recipe');
});

test('keyword matches description and address', async () => {
  assert.equal((await req(srv.base, '/bookmarks?q=runtime')).body.length, 1);
  assert.equal((await req(srv.base, '/bookmarks?q=nodejs.org')).body.length, 1);
});

test('keyword matches tag name', async () => {
  const { body } = await req(srv.base, '/bookmarks?q=reference');
  assert.equal(body.length, 1);
  assert.equal(body[0].title, 'Node.js Docs');
});

test('tag filter narrows results', async () => {
  const { body } = await req(srv.base, '/bookmarks?tag=food');
  assert.equal(body.length, 1);
  assert.equal(body[0].title, 'Pasta recipe');
});

test('no matches returns empty array', async () => {
  const { body } = await req(srv.base, '/bookmarks?q=zzzznotfound');
  assert.deepEqual(body, []);
});

test('GET /tags returns used tags', async () => {
  const { body } = await req(srv.base, '/tags');
  assert.ok(body.includes('tech'));
  assert.ok(body.includes('food'));
});
