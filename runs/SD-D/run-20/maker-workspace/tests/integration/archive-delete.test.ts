import { expect, it } from 'vitest';
import { buildApp } from '../../src/server/app';
import { temporaryDatabase } from '../fixtures/database';
it('preserves data through archive and restore and requires deletion confirmation', async () => {
  const fixture = temporaryDatabase();
  const app = await buildApp({ db: fixture.db });
  const created = (
    await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: { url: 'https://example.com/lifecycle', tagLabels: ['Keep'], readingState: 'unread' },
    })
  ).json();
  await app.inject({
    method: 'PATCH',
    url: `/api/bookmarks/${created.id}`,
    payload: { lifecycleState: 'archived' },
  });
  const archived = (await app.inject(`/api/bookmarks/${created.id}`)).json();
  expect(archived).toMatchObject({ lifecycleState: 'archived', readingState: 'unread' });
  expect(archived.tags[0].label).toBe('Keep');
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/bookmarks/bulk-actions',
        payload: { bookmarkIds: [created.id], action: 'delete' },
      })
    ).statusCode,
  ).toBe(422);
  await app.close();
  fixture.close();
});
