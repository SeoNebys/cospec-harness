import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, req } from '../helper.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

test('new bookmarks are unread and appear in the unread view', async () => {
  const { body: bm } = await req(srv.base, '/bookmarks', {
    method: 'POST', body: JSON.stringify({ address: 'https://read.example.com/', title: 'Read me' }),
  });
  assert.equal(bm.isRead, false);

  let unread = await req(srv.base, '/bookmarks?view=unread');
  assert.equal(unread.body.length, 1);

  // Mark read -> leaves unread view.
  const patched = await req(srv.base, `/bookmarks/${bm.id}`, {
    method: 'PATCH', body: JSON.stringify({ isRead: true }),
  });
  assert.equal(patched.body.isRead, true);

  unread = await req(srv.base, '/bookmarks?view=unread');
  assert.equal(unread.body.length, 0);

  // Mark unread again -> returns.
  await req(srv.base, `/bookmarks/${bm.id}`, {
    method: 'PATCH', body: JSON.stringify({ isRead: false }),
  });
  unread = await req(srv.base, '/bookmarks?view=unread');
  assert.equal(unread.body.length, 1);
});
