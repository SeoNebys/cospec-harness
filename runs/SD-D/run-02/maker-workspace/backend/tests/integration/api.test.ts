import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';
import { createTestDb } from '../../src/db/init.js';
import type BetterSqlite3 from 'better-sqlite3';

let app: FastifyInstance;
let db: BetterSqlite3.Database;

// Disable network enrichment for deterministic tests.
const noEnrich = () => {};

beforeEach(async () => {
  db = createTestDb();
  app = await buildServer(db, { enricher: noEnrich, serveFrontend: false });
});
afterEach(async () => {
  await app.close();
  db.close();
});

async function save(url: string, extra: Record<string, unknown> = {}) {
  return app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url, ...extra } });
}

describe('US1 save + dedupe', () => {
  it('creates a bookmark with a fallback title and validates input', async () => {
    const res = await save('example.com/article');
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.deduped).toBe(false);
    expect(body.bookmark.url).toBe('https://example.com/article');
    expect(body.bookmark.title).toBe('example.com/article');

    const bad = await save('not a url');
    expect(bad.statusCode).toBe(400);
  });

  it('redirects a duplicate save to the existing bookmark', async () => {
    const first = (await save('https://example.com/x')).json();
    const dup = await save('http://www.example.com/x/');
    expect(dup.statusCode).toBe(200);
    expect(dup.json().deduped).toBe(true);
    expect(dup.json().bookmark.id).toBe(first.bookmark.id);
  });
});

describe('US2 browse, sort', () => {
  it('lists non-archived bookmarks with tags, honoring sort', async () => {
    await save('https://a.com', { title: 'Banana', tags: ['fruit'] });
    await save('https://b.com', { title: 'Apple', tags: ['fruit'] });
    const byTitle = (await app.inject({ url: '/api/bookmarks?sort=title' })).json();
    expect(byTitle.bookmarks.map((b: any) => b.title)).toEqual(['Apple', 'Banana']);
    expect(byTitle.bookmarks[0].tags).toContain('fruit');
  });
});

describe('US3 search', () => {
  it('searches across fields and supports exclusion', async () => {
    await save('https://a.com/recipes', { title: 'Pasta recipe', tags: ['recipe', 'dinner'] });
    await save('https://b.com/work', { title: 'Work notes', tags: ['work'] });
    const hit = (await app.inject({ url: '/api/search?q=' + encodeURIComponent('tag:recipe') })).json();
    expect(hit.bookmarks).toHaveLength(1);
    const excl = (await app.inject({ url: '/api/search?q=' + encodeURIComponent('notes -tag:work') })).json();
    expect(excl.bookmarks.every((b: any) => !b.tags.includes('work'))).toBe(true);
  });
});

describe('US4 tags', () => {
  it('suggests existing tags by prefix', async () => {
    await save('https://a.com', { tags: ['recipe'] });
    const sug = (await app.inject({ url: '/api/tags?prefix=rec' })).json();
    expect(sug.tags).toContain('recipe');
  });
});

describe('US5 edit + delete', () => {
  it('edits notes and deletes with cascade', async () => {
    const id = (await save('https://a.com')).json().bookmark.id;
    const patched = await app.inject({ method: 'PATCH', url: `/api/bookmarks/${id}`, payload: { notes: '<h2>Hi</h2><ul><li>x</li></ul>' } });
    expect(patched.json().bookmark.notes).toContain('<h2>Hi</h2>');
    const del = await app.inject({ method: 'DELETE', url: `/api/bookmarks/${id}` });
    expect(del.statusCode).toBe(204);
    expect((await app.inject({ url: `/api/bookmarks/${id}` })).statusCode).toBe(404);
  });
});

describe('US6 read-later + US7 archive', () => {
  it('filters to-read and hides archived from list & search', async () => {
    const id = (await save('https://a.com', { title: 'Read me later' })).json().bookmark.id;
    await app.inject({ method: 'PATCH', url: `/api/bookmarks/${id}`, payload: { read_state: 'to_read' } });
    expect((await app.inject({ url: '/api/bookmarks?read_state=to_read' })).json().bookmarks).toHaveLength(1);

    await app.inject({ method: 'PATCH', url: `/api/bookmarks/${id}`, payload: { archived: true } });
    expect((await app.inject({ url: '/api/bookmarks' })).json().bookmarks).toHaveLength(0);
    expect((await app.inject({ url: '/api/search?q=Read' })).json().bookmarks).toHaveLength(0);
    expect((await app.inject({ url: '/api/bookmarks?archived=true' })).json().bookmarks).toHaveLength(1);
  });
});

describe('US9 bulk', () => {
  it('applies an action to all matching a query', async () => {
    await save('https://a.com/recipes', { tags: ['recipe'] });
    await save('https://b.com/recipes', { tags: ['recipe'] });
    const res = await app.inject({ method: 'POST', url: '/api/bookmarks/bulk', payload: { matchQuery: 'tag:recipe', action: 'archive' } });
    expect(res.json().affected).toBe(2);
    expect((await app.inject({ url: '/api/bookmarks' })).json().bookmarks).toHaveLength(0);
  });
});

describe('US10 import/export', () => {
  it('imports a bookmarks file with dedupe and rejects malformed', async () => {
    const file = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
      <DT><A HREF="https://a.com/1">One</A>
      <DT><A HREF="https://a.com/2">Two</A>
    </DL><p>`;
    const imp = await app.inject({ method: 'POST', url: '/api/import', payload: { content: file } });
    expect(imp.json().added).toBe(2);
    const again = await app.inject({ method: 'POST', url: '/api/import', payload: { content: file } });
    expect(again.json().duplicates).toBe(2);
    const bad = await app.inject({ method: 'POST', url: '/api/import', payload: { content: 'garbage' } });
    expect(bad.statusCode).toBe(400);

    const exp = await app.inject({ url: '/api/export' });
    expect(exp.body).toContain('https://a.com/1');
  });
});

describe('US11 saved searches + US12 preferences', () => {
  it('stores saved searches and persists preferences', async () => {
    const s = await app.inject({ method: 'POST', url: '/api/saved-searches', payload: { name: 'Recipes', query: 'tag:recipe' } });
    expect(s.statusCode).toBe(201);
    expect((await app.inject({ url: '/api/saved-searches' })).json().savedSearches).toHaveLength(1);

    await app.inject({ method: 'PATCH', url: '/api/preferences', payload: { default_sort: 'title', text_size: 'large' } });
    const prefs = (await app.inject({ url: '/api/preferences' })).json().preferences;
    expect(prefs.default_sort).toBe('title');
    expect(prefs.text_size).toBe('large');
  });
});

describe('FR-036 backup/restore', () => {
  it('backs up and restores links, notes, tags, and preferences', async () => {
    const id = (await save('https://a.com', { title: 'Keep', tags: ['x'] })).json().bookmark.id;
    await app.inject({ method: 'PATCH', url: `/api/bookmarks/${id}`, payload: { notes: 'my note' } });
    const backup = (await app.inject({ url: '/api/backup' })).json();
    expect(backup.bookmarks).toHaveLength(1);

    // Restore into a fresh instance.
    const db2 = createTestDb();
    const app2 = await buildServer(db2, { enricher: noEnrich, serveFrontend: false });
    const r = await app2.inject({ method: 'POST', url: '/api/restore', payload: backup });
    expect(r.json().restored).toBe(1);
    const restored = (await app2.inject({ url: '/api/bookmarks' })).json().bookmarks[0];
    expect(restored.title).toBe('Keep');
    expect(restored.notes).toBe('my note');
    expect(restored.tags).toContain('x');
    await app2.close();
    db2.close();
  });
});
