import { expect, it } from 'vitest';
import { buildApp } from '../../src/server/app';
import { temporaryDatabase } from '../fixtures/database';
it('applies tags, reading state, archive, restore, and confirmed archive-only deletion with summaries', async () => {
  const fixture = temporaryDatabase();
  const app = await buildApp({ db: fixture.db });
  const ids = [];
  for (let index = 0; index < 2; index++)
    ids.push(
      (
        await app.inject({
          method: 'POST',
          url: '/api/bookmarks',
          payload: { url: `https://example.com/bulk-${index}` },
        })
      ).json().id,
    );
  const action = async (body: unknown) =>
    (await app.inject({ method: 'POST', url: '/api/bookmarks/bulk-actions', payload: body as never })).json();
  expect(
    (await action({ bookmarkIds: ids, action: 'addTags', tagLabels: ['Batch'] })).changedIds,
  ).toHaveLength(2);
  expect((await action({ bookmarkIds: ids, action: 'markUnread' })).changedIds).toHaveLength(2);
  expect((await action({ bookmarkIds: ids, action: 'archive' })).changedIds).toHaveLength(2);
  expect((await action({ bookmarkIds: ids, action: 'restore' })).changedIds).toHaveLength(2);
  const denied = await app.inject({
    method: 'POST',
    url: '/api/bookmarks/bulk-actions',
    payload: { bookmarkIds: ids, action: 'delete', confirmed: true },
  });
  expect(denied.json().failures).toHaveLength(2);
  await action({ bookmarkIds: ids, action: 'archive' });
  expect((await action({ bookmarkIds: ids, action: 'delete', confirmed: true })).changedIds).toHaveLength(2);
  await app.close();
  fixture.close();
});
