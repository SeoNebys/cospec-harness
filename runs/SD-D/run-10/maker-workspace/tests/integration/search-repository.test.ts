import { createBookmark } from '../helpers/bookmark-api';
import { createTestApp, mutationHeaders, registerTestUser } from '../helpers/test-app';

describe('search repository integration', () => {
  it('keeps owner, context, filters, projection changes, stable sort, and cursors consistent', async () => {
    const app = await createTestApp();
    const owner = await registerTestUser(app, 'search-owner@example.test');
    const other = await registerTestUser(app, 'search-other@example.test');
    const tag = (
      await app.inject({
        method: 'POST',
        url: '/api/tags',
        headers: mutationHeaders(owner),
        payload: { name: 'Research' },
      })
    ).json();
    const first = await createBookmark(app, owner, {
      title: 'Projection alpha',
      tagIds: [tag.id],
      readingState: 'unread',
    });
    await createBookmark(app, owner, { title: 'Projection beta' });
    await createBookmark(app, other, { title: 'Projection secret' });
    const filtered = await app.inject({
      method: 'GET',
      url: `/api/bookmarks?query=projection&includeTag=${tag.id}&reading=unread&sort=title&limit=1`,
      headers: { cookie: owner.cookie },
    });
    expect(filtered.json()).toMatchObject({ page: { total: 1 }, items: [{ id: first.id }] });
    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/bookmarks/${first.id}`,
      headers: mutationHeaders(owner),
      payload: { expectedVersion: first.version, title: 'Renamed searchable phrase' },
    });
    expect(updated.statusCode).toBe(200);
    const old = await app.inject({
      method: 'GET',
      url: '/api/bookmarks?query=alpha',
      headers: { cookie: owner.cookie },
    });
    const renamed = await app.inject({
      method: 'GET',
      url: '/api/bookmarks?query=renamed',
      headers: { cookie: owner.cookie },
    });
    expect(old.json().page.total).toBe(0);
    expect(renamed.json().page.total).toBe(1);
    await app.close();
  });
});
