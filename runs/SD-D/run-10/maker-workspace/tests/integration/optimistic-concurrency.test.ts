import { createBookmark } from '../helpers/bookmark-api';
import { createTestApp, mutationHeaders, registerTestUser } from '../helpers/test-app';

describe('optimistic concurrency', () => {
  it('rejects stale bookmark, tag, collection, and saved-search updates', async () => {
    const app = await createTestApp();
    const session = await registerTestUser(app, 'concurrency@example.test');
    const bookmark = await createBookmark(app, session);
    await app.inject({
      method: 'PATCH',
      url: `/api/bookmarks/${bookmark.id}`,
      headers: mutationHeaders(session),
      payload: { expectedVersion: bookmark.version, title: 'First edit' },
    });
    const staleBookmark = await app.inject({
      method: 'PATCH',
      url: `/api/bookmarks/${bookmark.id}`,
      headers: mutationHeaders(session),
      payload: { expectedVersion: bookmark.version, title: 'Second edit' },
    });
    expect(staleBookmark.json()).toMatchObject({ code: 'stale_version', current: { title: 'First edit' } });
    const tag = (
      await app.inject({
        method: 'POST',
        url: '/api/tags',
        headers: mutationHeaders(session),
        payload: { name: 'One' },
      })
    ).json();
    await app.inject({
      method: 'PATCH',
      url: `/api/tags/${tag.id}`,
      headers: mutationHeaders(session),
      payload: { expectedVersion: tag.version, name: 'Two' },
    });
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/tags/${tag.id}`,
          headers: mutationHeaders(session),
          payload: { expectedVersion: tag.version, name: 'Three' },
        })
      ).statusCode,
    ).toBe(409);
    const collection = (
      await app.inject({
        method: 'POST',
        url: '/api/collections',
        headers: mutationHeaders(session),
        payload: { name: 'One collection' },
      })
    ).json();
    await app.inject({
      method: 'PATCH',
      url: `/api/collections/${collection.id}`,
      headers: mutationHeaders(session),
      payload: { expectedVersion: collection.version, name: 'Two collection' },
    });
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/collections/${collection.id}`,
          headers: mutationHeaders(session),
          payload: { expectedVersion: collection.version, name: 'Three collection' },
        })
      ).statusCode,
    ).toBe(409);
    const saved = (
      await app.inject({
        method: 'POST',
        url: '/api/saved-searches',
        headers: mutationHeaders(session),
        payload: { name: 'One search', criteria: {} },
      })
    ).json();
    await app.inject({
      method: 'PATCH',
      url: `/api/saved-searches/${saved.id}`,
      headers: mutationHeaders(session),
      payload: { expectedVersion: saved.version, name: 'Two search' },
    });
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/saved-searches/${saved.id}`,
          headers: mutationHeaders(session),
          payload: { expectedVersion: saved.version, name: 'Three search' },
        })
      ).statusCode,
    ).toBe(409);
    await app.close();
  });
});
