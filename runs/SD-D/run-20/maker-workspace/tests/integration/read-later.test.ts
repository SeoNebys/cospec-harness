import { expect, it } from 'vitest';
import { buildApp } from '../../src/server/app';
import { temporaryDatabase } from '../fixtures/database';
it('supports explicit reading transitions and active unread filtering', async () => {
  const fixture = temporaryDatabase();
  const app = await buildApp({ db: fixture.db });
  const created = (
    await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: { url: 'https://example.com/read', readingState: 'unread' },
    })
  ).json();
  expect((await app.inject('/api/bookmarks?view=unread')).json().total).toBe(1);
  await app.inject({
    method: 'PATCH',
    url: `/api/bookmarks/${created.id}`,
    payload: { readingState: 'read' },
  });
  expect((await app.inject('/api/bookmarks?view=unread')).json().total).toBe(0);
  expect((await app.inject(`/api/bookmarks/${created.id}`)).json().readingState).toBe('read');
  await app.close();
  fixture.close();
});
