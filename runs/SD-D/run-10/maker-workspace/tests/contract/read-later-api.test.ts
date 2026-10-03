import { createBookmark } from '../helpers/bookmark-api';
import { createTestApp, mutationHeaders, registerTestUser } from '../helpers/test-app';

describe('Read Later API', () => {
  it('keeps reading and favorite state independent and lists active unread items', async () => {
    const app = await createTestApp();
    const session = await registerTestUser(app, 'read-later@example.test');
    const item = await createBookmark(app, session, { readingState: 'unread', isFavorite: true });
    const unread = await app.inject({
      method: 'GET',
      url: '/api/bookmarks?reading=unread',
      headers: { cookie: session.cookie },
    });
    expect(unread.json().page.total).toBe(1);
    const read = await app.inject({
      method: 'POST',
      url: `/api/bookmarks/${item.id}/reading`,
      headers: mutationHeaders(session),
      payload: { expectedVersion: item.version, value: 'read' },
    });
    expect(read.json()).toMatchObject({ readingState: 'read', isFavorite: true });
    const after = await app.inject({
      method: 'GET',
      url: '/api/bookmarks?reading=unread',
      headers: { cookie: session.cookie },
    });
    expect(after.json().page.total).toBe(0);
    await app.close();
  });
});
