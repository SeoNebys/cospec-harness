import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, registerTestUser } from '../helpers/test-app';

describe('bookmark capture API', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => app?.close());

  it('creates, persists, edits, and rejects a normalized duplicate', async () => {
    app = await createTestApp();
    const session = await registerTestUser(app, 'bookmarks@example.test');
    const headers = { cookie: session.cookie, 'x-csrf-token': session.csrf, origin: 'http://localhost' };
    const created = await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      headers,
      payload: {
        url: 'https://Example.com:443/path#fragment',
        title: 'Original',
        description: null,
        noteMarkdown: '## Note\n\n**Useful**',
        tagIds: [],
        newTagNames: [],
        collectionId: null,
        isFavorite: false,
        readingState: 'none',
      },
    });
    expect(created.statusCode).toBe(201);
    const bookmark = created.json();
    expect(bookmark.notePlain).toBe('Note Useful');
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      headers,
      payload: { url: 'https://example.com/path', title: 'Duplicate' },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().code).toBe('duplicate_bookmark');
    const edited = await app.inject({
      method: 'PATCH',
      url: `/api/bookmarks/${bookmark.id}`,
      headers,
      payload: { expectedVersion: 1, title: 'Edited' },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toMatchObject({ title: 'Edited', version: 2 });
  });

  it('does not expose one account bookmark to another', async () => {
    app = await createTestApp();
    const owner = await registerTestUser(app, 'one@example.test');
    const other = await registerTestUser(app, 'two@example.test');
    const created = await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      headers: { cookie: owner.cookie, 'x-csrf-token': owner.csrf, origin: 'http://localhost' },
      payload: { url: 'https://example.com/private', title: 'Private' },
    });
    const id = created.json().id;
    expect(
      (await app.inject({ method: 'GET', url: `/api/bookmarks/${id}`, headers: { cookie: other.cookie } }))
        .statusCode,
    ).toBe(404);
  });

  it('protects metadata and media endpoints and rejects private fetch destinations', async () => {
    app = await createTestApp();
    const session = await registerTestUser(app, 'capture-security@example.test');
    const headers = {
      cookie: session.cookie,
      'x-csrf-token': session.csrf,
      origin: 'http://localhost',
    };
    const metadata = await app.inject({
      method: 'POST',
      url: '/api/metadata/preview',
      headers,
      payload: { url: 'http://127.0.0.1/private' },
    });
    expect(metadata.statusCode).toBe(422);
    expect(metadata.json().code).toBe('unsafe_destination');

    const capture = await app.inject({
      method: 'POST',
      url: '/api/media/capture',
      headers,
      payload: { purpose: 'preview', url: 'http://169.254.169.254/latest/meta-data' },
    });
    expect(capture.statusCode).toBe(422);
    expect(capture.json().code).toBe('unsafe_destination');
    expect((await app.inject({ method: 'GET', url: '/api/media/med_missing' })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/media/med_missing',
          headers: { cookie: session.cookie },
        })
      ).statusCode,
    ).toBe(404);
  });

  it('paginates the active library with a stable opaque cursor', async () => {
    app = await createTestApp();
    const session = await registerTestUser(app, 'pages@example.test');
    const headers = {
      cookie: session.cookie,
      'x-csrf-token': session.csrf,
      origin: 'http://localhost',
    };
    for (const index of [1, 2, 3]) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/bookmarks',
            headers,
            payload: { url: `https://example.com/page-${index}`, title: `Page ${index}` },
          })
        ).statusCode,
      ).toBe(201);
    }
    const first = await app.inject({
      method: 'GET',
      url: '/api/bookmarks?limit=2',
      headers: { cookie: session.cookie },
    });
    expect(first.statusCode).toBe(200);
    const firstPage = first.json();
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.page).toMatchObject({ total: 3, hasMore: true });
    expect(firstPage.page.nextCursor).toEqual(expect.any(String));

    const second = await app.inject({
      method: 'GET',
      url: `/api/bookmarks?limit=2&cursor=${encodeURIComponent(firstPage.page.nextCursor)}`,
      headers: { cookie: session.cookie },
    });
    const secondPage = second.json();
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.page).toMatchObject({ total: 3, hasMore: false, nextCursor: null });
    expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/bookmarks?cursor=not-a-cursor',
          headers: { cookie: session.cookie },
        })
      ).statusCode,
    ).toBe(422);
  });
});
