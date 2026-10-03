import { createBookmark } from '../helpers/bookmark-api';
import { createTestApp, mutationHeaders, registerTestUser } from '../helpers/test-app';

const criteria = {
  query: 'climate',
  includeTagIds: [],
  excludeTagIds: [],
  collection: { mode: 'any' },
  favorite: 'any',
  reading: 'any',
  context: 'active',
  sort: 'newest',
};

describe('saved search API', () => {
  it('persists reusable criteria, reports live counts, versions updates, and deletes independently', async () => {
    const app = await createTestApp();
    const session = await registerTestUser(app, 'saved@example.test');
    await createBookmark(app, session, { title: 'Climate one' });
    const created = await app.inject({
      method: 'POST',
      url: '/api/saved-searches',
      headers: mutationHeaders(session),
      payload: { name: 'Climate queue', criteria },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().matchCount).toBe(1);
    await createBookmark(app, session, { title: 'Climate two' });
    const listed = await app.inject({
      method: 'GET',
      url: '/api/saved-searches',
      headers: { cookie: session.cookie },
    });
    expect(listed.json().items[0].matchCount).toBe(2);
    const saved = listed.json().items[0];
    const renamed = await app.inject({
      method: 'PATCH',
      url: `/api/saved-searches/${saved.id}`,
      headers: mutationHeaders(session),
      payload: { expectedVersion: saved.version, name: 'Climate now' },
    });
    expect(renamed.json()).toMatchObject({ name: 'Climate now', version: saved.version + 1 });
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/saved-searches/${saved.id}`,
      headers: mutationHeaders(session),
      payload: { expectedVersion: renamed.json().version },
    });
    expect(removed.statusCode).toBe(204);
    const bookmarks = await app.inject({
      method: 'GET',
      url: '/api/bookmarks',
      headers: { cookie: session.cookie },
    });
    expect(bookmarks.json().page.total).toBe(2);
    await app.close();
  });
});
