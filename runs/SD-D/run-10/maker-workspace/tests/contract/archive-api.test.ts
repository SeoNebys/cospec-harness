import { createBookmark } from '../helpers/bookmark-api';
import { createTestApp, mutationHeaders, registerTestUser } from '../helpers/test-app';

describe('archive API', () => {
  it('round-trips all state and keeps delete permanent and confirmed', async () => {
    const app = await createTestApp();
    const session = await registerTestUser(app, 'archive@example.test');
    const item = await createBookmark(app, session, {
      readingState: 'unread',
      isFavorite: true,
      noteMarkdown: '**keep**',
    });
    const archived = await app.inject({
      method: 'POST',
      url: `/api/bookmarks/${item.id}/archive`,
      headers: mutationHeaders(session),
      payload: { expectedVersion: item.version },
    });
    expect(archived.json()).toMatchObject({
      readingState: 'unread',
      isFavorite: true,
      noteMarkdown: '**keep**',
    });
    const activeList = await app.inject({
      method: 'GET',
      url: '/api/bookmarks?context=active',
      headers: { cookie: session.cookie },
    });
    const archiveList = await app.inject({
      method: 'GET',
      url: '/api/bookmarks?context=archive',
      headers: { cookie: session.cookie },
    });
    expect(activeList.json().page.total).toBe(0);
    expect(archiveList.json().page.total).toBe(1);
    const restored = await app.inject({
      method: 'POST',
      url: `/api/bookmarks/${item.id}/restore`,
      headers: mutationHeaders(session),
      payload: { expectedVersion: archived.json().version },
    });
    expect(restored.json()).toMatchObject({ archivedAt: null, readingState: 'unread', isFavorite: true });
    const refused = await app.inject({
      method: 'DELETE',
      url: `/api/bookmarks/${item.id}`,
      headers: mutationHeaders(session),
      payload: { expectedVersion: restored.json().version, confirmation: 'archive' },
    });
    expect(refused.statusCode).toBe(422);
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/bookmarks/${item.id}`,
      headers: mutationHeaders(session),
      payload: { expectedVersion: restored.json().version, confirmation: 'permanent' },
    });
    expect(removed.statusCode).toBe(204);
    await app.close();
  });
});
