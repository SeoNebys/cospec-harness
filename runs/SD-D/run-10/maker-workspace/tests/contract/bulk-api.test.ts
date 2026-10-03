import { createBookmark } from '../helpers/bookmark-api';
import { createTestApp, mutationHeaders, registerTestUser } from '../helpers/test-app';

describe('bulk API', () => {
  it('previews exact counts, applies non-destructive actions, and requires single-use destructive confirmation', async () => {
    const app = await createTestApp();
    const session = await registerTestUser(app, 'bulk@example.test');
    const one = await createBookmark(app, session, { title: 'Bulk one' });
    const two = await createBookmark(app, session, { title: 'Bulk two' });
    const selection = {
      mode: 'ids',
      items: [
        { id: one.id, expectedVersion: one.version },
        { id: two.id, expectedVersion: two.version },
      ],
    };
    const read = await app.inject({
      method: 'POST',
      url: '/api/bookmarks/bulk/execute',
      headers: mutationHeaders(session),
      payload: { selection, action: { type: 'reading.set', value: 'unread' } },
    });
    expect(read.json()).toMatchObject({ selectedCount: 2, succeededCount: 2, failedCount: 0 });
    const latest = (
      await app.inject({
        method: 'GET',
        url: '/api/bookmarks?reading=unread',
        headers: { cookie: session.cookie },
      })
    ).json().items;
    const archiveSelection = {
      mode: 'ids',
      items: latest.map((item: { id: string; version: number }) => ({
        id: item.id,
        expectedVersion: item.version,
      })),
    };
    const preview = await app.inject({
      method: 'POST',
      url: '/api/bookmarks/bulk/preview',
      headers: mutationHeaders(session),
      payload: { selection: archiveSelection, action: { type: 'archive' } },
    });
    expect(preview.json()).toMatchObject({
      selectionCount: 2,
      eligibleCount: 2,
      confirmation: { required: true, expectedCount: 2 },
    });
    const executePayload = {
      selection: archiveSelection,
      action: { type: 'archive' },
      confirmationToken: preview.json().confirmation.token,
    };
    const archived = await app.inject({
      method: 'POST',
      url: '/api/bookmarks/bulk/execute',
      headers: mutationHeaders(session),
      payload: executePayload,
    });
    expect(archived.json()).toMatchObject({ succeededCount: 2, failedCount: 0 });
    const replay = await app.inject({
      method: 'POST',
      url: '/api/bookmarks/bulk/execute',
      headers: mutationHeaders(session),
      payload: executePayload,
    });
    expect(replay.statusCode).toBe(422);
    await app.close();
  });

  it('makes no mutation when an all-matches destructive selection changes after preview', async () => {
    const app = await createTestApp();
    const session = await registerTestUser(app, 'bulk-change@example.test');
    await createBookmark(app, session, { title: 'Dynamic set one' });
    const criteria = {
      query: 'dynamic',
      includeTagIds: [],
      excludeTagIds: [],
      collection: { mode: 'any' },
      favorite: 'any',
      reading: 'any',
      context: 'active',
      sort: 'newest',
    };
    const selection = { mode: 'query', criteria };
    const preview = await app.inject({
      method: 'POST',
      url: '/api/bookmarks/bulk/preview',
      headers: mutationHeaders(session),
      payload: { selection, action: { type: 'archive' } },
    });
    await createBookmark(app, session, { title: 'Dynamic set two' });
    const execute = await app.inject({
      method: 'POST',
      url: '/api/bookmarks/bulk/execute',
      headers: mutationHeaders(session),
      payload: {
        selection,
        action: { type: 'archive' },
        confirmationToken: preview.json().confirmation.token,
      },
    });
    expect(execute.json()).toMatchObject({ code: 'selection_changed', expectedCount: 1, currentCount: 2 });
    const active = await app.inject({
      method: 'GET',
      url: '/api/bookmarks?query=dynamic',
      headers: { cookie: session.cookie },
    });
    expect(active.json().page.total).toBe(2);
    await app.close();
  });
});
