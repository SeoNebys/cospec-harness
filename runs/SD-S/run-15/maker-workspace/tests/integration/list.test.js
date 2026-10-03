import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, req } from '../helper.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

test('active view lists bookmarks newest first', async () => {
  await req(srv.base, '/bookmarks', {
    method: 'POST', body: JSON.stringify({ address: 'https://first.example.com/', title: 'First' }),
  });
  await new Promise((r) => setTimeout(r, 5));
  await req(srv.base, '/bookmarks', {
    method: 'POST', body: JSON.stringify({ address: 'https://second.example.com/', title: 'Second' }),
  });

  const { status, body } = await req(srv.base, '/bookmarks?view=active');
  assert.equal(status, 200);
  assert.equal(body.length, 2);
  assert.equal(body[0].title, 'Second');
  assert.equal(body[1].title, 'First');
});
