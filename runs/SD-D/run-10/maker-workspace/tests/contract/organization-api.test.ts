import { createBookmark } from '../helpers/bookmark-api';
import { createTestApp, mutationHeaders, registerTestUser } from '../helpers/test-app';

describe('organization API', () => {
  it('reuses normalized tags, suggests them, and unfiles without changing tags', async () => {
    const app = await createTestApp();
    const session = await registerTestUser(app, 'organize@example.test');
    const first = await app.inject({
      method: 'POST',
      url: '/api/tags',
      headers: mutationHeaders(session),
      payload: { name: 'Climate News' },
    });
    const tag = first.json();
    const reused = await app.inject({
      method: 'POST',
      url: '/api/tags',
      headers: mutationHeaders(session),
      payload: { name: ' climate   NEWS ' },
    });
    expect(reused.statusCode).toBe(200);
    expect(reused.json().id).toBe(tag.id);
    const collectionResponse = await app.inject({
      method: 'POST',
      url: '/api/collections',
      headers: mutationHeaders(session),
      payload: { name: 'Reference' },
    });
    const collection = collectionResponse.json();
    const bookmark = await createBookmark(app, session, {
      tagIds: [tag.id],
      collectionId: collection.id,
      isFavorite: true,
    });
    const suggestions = await app.inject({
      method: 'GET',
      url: '/api/tags?suggest=cli',
      headers: { cookie: session.cookie },
    });
    expect(suggestions.json().items[0].id).toBe(tag.id);
    const impact = await app.inject({
      method: 'GET',
      url: `/api/collections/${collection.id}/deletion-impact`,
      headers: { cookie: session.cookie },
    });
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/collections/${collection.id}`,
      headers: mutationHeaders(session),
      payload: {
        expectedVersion: collection.version,
        confirmation: 'unfile',
        expectedBookmarkCount: impact.json().bookmarkCount,
      },
    });
    expect(deleted.statusCode).toBe(204);
    const retained = await app.inject({
      method: 'GET',
      url: `/api/bookmarks/${bookmark.id}`,
      headers: { cookie: session.cookie },
    });
    expect(retained.json()).toMatchObject({
      collection: null,
      isFavorite: true,
      tags: [{ id: tag.id, name: 'Climate News' }],
    });
    const target = (
      await app.inject({
        method: 'POST',
        url: '/api/tags',
        headers: mutationHeaders(session),
        payload: { name: 'Research' },
      })
    ).json();
    const collision = await app.inject({
      method: 'PATCH',
      url: `/api/tags/${tag.id}`,
      headers: mutationHeaders(session),
      payload: { expectedVersion: tag.version, name: ' research ' },
    });
    expect(collision.json()).toMatchObject({ code: 'tag_merge_required', targetTag: { id: target.id } });
    const merged = await app.inject({
      method: 'POST',
      url: `/api/tags/${tag.id}/merge`,
      headers: mutationHeaders(session),
      payload: { expectedVersion: tag.version, targetTagId: target.id, confirmation: 'merge' },
    });
    expect(merged.json()).toMatchObject({ tag: { id: target.id }, movedBookmarks: 1 });
    const indexed = await app.inject({
      method: 'GET',
      url: '/api/bookmarks?query=%23research',
      headers: { cookie: session.cookie },
    });
    expect(indexed.json().page.total).toBe(1);
    await app.close();
  });
});
