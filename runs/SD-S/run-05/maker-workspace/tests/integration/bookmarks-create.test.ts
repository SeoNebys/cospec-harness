import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb, type DB } from '../../src/server/db';
import { buildApp } from '../../src/server/app';

// The title service uses global fetch when saving without an explicit title.
// These tests always supply a title, so no network call is made.

let db: DB;
let app: FastifyInstance;

beforeEach(async () => {
  db = openDb(':memory:');
  app = buildApp(db);
  await app.ready();
});

afterEach(async () => {
  await app.close();
  db.close();
});

async function post(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/bookmarks', payload });
}

describe('POST /api/bookmarks (FR-001, FR-002, FR-004)', () => {
  it('saves a valid bookmark and returns 201 with its fields', async () => {
    const res = await post({ url: 'https://example.com/page', title: 'Example' });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.url).toBe('https://example.com/page');
    expect(body.title).toBe('Example');
    expect(body.id).toBeTypeOf('number');
    expect(body.createdAt).toBeTruthy();
    expect(body.tags).toEqual([]);
  });

  it('rejects an invalid address with 400 and an explanation', async () => {
    const res = await post({ url: 'not a url', title: 'x' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('invalid_url');
    expect(body.message).toMatch(/http/i);
  });

  it('rejects a non-http scheme', async () => {
    const res = await post({ url: 'ftp://example.com', title: 'x' });
    expect(res.statusCode).toBe(400);
  });

  it('stores attached tags', async () => {
    const res = await post({
      url: 'https://tagged.com',
      title: 'Tagged',
      tags: ['work', 'reading'],
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().tags.sort()).toEqual(['reading', 'work']);
  });

  it('warns with 409 and the existing bookmark on a duplicate address', async () => {
    await post({ url: 'https://dup.com', title: 'first' });
    const res = await post({ url: 'HTTPS://DUP.com', title: 'second' });
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error).toBe('duplicate');
    expect(body.existing.title).toBe('first');
  });
});

describe('GET /api/bookmarks (FR-006)', () => {
  it('lists saved bookmarks, newest first', async () => {
    await post({ url: 'https://a.com', title: 'A' });
    await post({ url: 'https://b.com', title: 'B' });
    const res = await app.inject({ method: 'GET', url: '/api/bookmarks' });
    expect(res.statusCode).toBe(200);
    const titles = res.json().bookmarks.map((b: { title: string }) => b.title);
    expect(titles).toEqual(['B', 'A']);
  });

  it('returns an empty array when there are no bookmarks', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/bookmarks' });
    expect(res.json().bookmarks).toEqual([]);
  });
});
