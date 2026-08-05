import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb, type DB } from '../../src/server/db/connection';
import { buildApp } from '../../src/server/app';
import { applyEnrichment } from '../../src/server/db/queries';

// Integration tests for POST/GET bookmarks against an in-memory SQLite DB with a
// stubbed enrichment step (no network). Covers US1 acceptance scenarios.

let db: DB;
let app: FastifyInstance;

beforeEach(async () => {
  db = openDb(':memory:');
  // Stub: synchronously mark enrichment done with a fetched title/description,
  // standing in for the background metadata fetch.
  const enrich = (d: DB, id: number): void => {
    applyEnrichment(d, id, 'done', {
      title: 'Fetched Title',
      description: 'Fetched description.',
      iconUrl: 'https://x/favicon.ico',
      imageUrl: 'https://x/preview.png',
    });
  };
  app = buildApp({ db, enrich });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  db.close();
});

async function create(body: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/bookmarks', payload: body });
}

describe('POST /api/bookmarks (US1)', () => {
  it('creates a bookmark and it appears in the list (scenario 1)', async () => {
    const res = await create({ url: 'https://example.com/page' });
    expect(res.statusCode).toBe(201);
    const { bookmark, existing } = res.json();
    expect(existing).toBe(false);
    expect(bookmark.url).toBe('https://example.com/page');

    const list = await app.inject({ method: 'GET', url: '/api/bookmarks' });
    expect(list.json().bookmarks).toHaveLength(1);
  });

  it('defaults the title to the address when none is given (scenario 2, FR-004)', async () => {
    // Use a fresh app WITHOUT enrichment so we observe the raw default title.
    const bareApp = buildApp({ db, enrich: () => {} });
    await bareApp.ready();
    const res = await bareApp.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: { url: 'example.org' },
    });
    expect(res.json().bookmark.title).toBe('https://example.org/');
    await bareApp.close();
  });

  it('normalizes an address without a scheme (edge case)', async () => {
    const res = await create({ url: 'example.net' });
    expect(res.json().bookmark.url).toBe('https://example.net/');
  });

  it('rejects a malformed address with a message and saves nothing (scenario 3, FR-002)', async () => {
    const res = await create({ url: 'not a url' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBeTruthy();
    const list = await app.inject({ method: 'GET', url: '/api/bookmarks' });
    expect(list.json().bookmarks).toHaveLength(0);
  });

  it('returns the existing bookmark instead of duplicating (FR-023, SC-007)', async () => {
    const first = await create({ url: 'https://example.com/' });
    expect(first.statusCode).toBe(201);
    const again = await create({ url: 'example.com' }); // same normalized key
    expect(again.statusCode).toBe(200);
    expect(again.json().existing).toBe(true);
    expect(again.json().bookmark.id).toBe(first.json().bookmark.id);

    const list = await app.inject({ method: 'GET', url: '/api/bookmarks' });
    expect(list.json().bookmarks).toHaveLength(1);
  });

  it('applies enrichment picked up via GET /:id (scenario 1, FR-005)', async () => {
    const created = await create({ url: 'https://example.com/x' });
    const id = created.json().bookmark.id;
    const got = await app.inject({ method: 'GET', url: `/api/bookmarks/${id}` });
    const b = got.json().bookmark;
    expect(b.enrichStatus).toBe('done');
    expect(b.title).toBe('Fetched Title');
    expect(b.description).toBe('Fetched description.');
    expect(b.imageUrl).toBe('https://x/preview.png');
  });

  it('does not overwrite a user-provided description during enrichment (FR-006)', async () => {
    const created = await create({
      url: 'https://example.com/y',
      description: 'My own words',
    });
    const id = created.json().bookmark.id;
    const got = await app.inject({ method: 'GET', url: `/api/bookmarks/${id}` });
    expect(got.json().bookmark.description).toBe('My own words');
  });

  it('404s for an unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/bookmarks/9999' });
    expect(res.statusCode).toBe(404);
  });

  it('accepts a person-supplied title, tags, and note at save (FR-003)', async () => {
    const bareApp = buildApp({ db, enrich: () => {} });
    await bareApp.ready();
    const res = await bareApp.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: {
        url: 'https://example.com/withdetails',
        title: 'My Title',
        tags: ['recipes', 'dinner'],
        notes: 'remember this',
      },
    });
    const b = res.json().bookmark;
    expect(b.title).toBe('My Title');
    expect(b.tags).toEqual(['dinner', 'recipes']); // stored lowercased, sorted
    expect(b.notes).toBe('remember this');
    await bareApp.close();
  });
});

describe('PATCH /api/bookmarks/:id (US1 edit, FR-003/FR-006)', () => {
  it('edits a fetched description and the change persists (scenario 4)', async () => {
    const created = await create({ url: 'https://example.com/e' });
    const id = created.json().bookmark.id;
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/bookmarks/${id}`,
      payload: { description: 'My better words' },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().bookmark.description).toBe('My better words');

    const got = await app.inject({ method: 'GET', url: `/api/bookmarks/${id}` });
    expect(got.json().bookmark.description).toBe('My better words');
  });

  it('edits title and tags', async () => {
    const created = await create({ url: 'https://example.com/t' });
    const id = created.json().bookmark.id;
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/bookmarks/${id}`,
      payload: { title: 'Renamed', tags: ['a', 'b'] },
    });
    const b = patched.json().bookmark;
    expect(b.title).toBe('Renamed');
    expect(b.tags).toEqual(['a', 'b']);
  });

  it('404s when editing an unknown id', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/bookmarks/9999',
      payload: { title: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });
});
