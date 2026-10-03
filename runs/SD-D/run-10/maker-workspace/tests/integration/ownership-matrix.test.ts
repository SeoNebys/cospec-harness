import { createBookmark } from '../helpers/bookmark-api';
import { createTestApp, mutationHeaders, registerTestUser } from '../helpers/test-app';

describe('ownership matrix', () => {
  it('returns enumeration-safe not-found outcomes across owned resource types', async () => {
    const app = await createTestApp();
    const owner = await registerTestUser(app, 'matrix-owner@example.test');
    const stranger = await registerTestUser(app, 'matrix-stranger@example.test');
    const bookmark = await createBookmark(app, owner);
    const tag = (
      await app.inject({
        method: 'POST',
        url: '/api/tags',
        headers: mutationHeaders(owner),
        payload: { name: 'Private tag' },
      })
    ).json();
    const collection = (
      await app.inject({
        method: 'POST',
        url: '/api/collections',
        headers: mutationHeaders(owner),
        payload: { name: 'Private collection' },
      })
    ).json();
    const saved = (
      await app.inject({
        method: 'POST',
        url: '/api/saved-searches',
        headers: mutationHeaders(owner),
        payload: { name: 'Private saved search', criteria: {} },
      })
    ).json();
    const requests = [
      app.inject({
        method: 'GET',
        url: `/api/bookmarks/${bookmark.id}`,
        headers: { cookie: stranger.cookie },
      }),
      app.inject({
        method: 'PATCH',
        url: `/api/tags/${tag.id}`,
        headers: mutationHeaders(stranger),
        payload: { expectedVersion: tag.version, name: 'Stolen' },
      }),
      app.inject({
        method: 'GET',
        url: `/api/collections/${collection.id}/deletion-impact`,
        headers: { cookie: stranger.cookie },
      }),
      app.inject({
        method: 'GET',
        url: `/api/saved-searches/${saved.id}`,
        headers: { cookie: stranger.cookie },
      }),
    ];
    for (const response of await Promise.all(requests)) expect(response.statusCode).toBe(404);
    const foreignBulk = await app.inject({
      method: 'POST',
      url: '/api/bookmarks/bulk/preview',
      headers: mutationHeaders(stranger),
      payload: {
        selection: { mode: 'ids', items: [{ id: bookmark.id, expectedVersion: bookmark.version }] },
        action: { type: 'favorite.set', value: true },
      },
    });
    expect(foreignBulk.json()).toMatchObject({
      selectionCount: 1,
      eligibleCount: 0,
      ineligible: [{ reason: 'not_found' }],
    });
    await app.close();
  });
});
