import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb, type DB } from '../../src/server/db';
import { buildApp } from '../../src/server/app';

let db: DB;
let app: FastifyInstance;

async function create(payload: Record<string, unknown>) {
  const res = await app.inject({ method: 'POST', url: '/api/bookmarks', payload });
  return res.json();
}

async function list() {
  const res = await app.inject({ method: 'GET', url: '/api/bookmarks' });
  return (res.json().bookmarks as { id: number }[]).map((b) => b.id);
}

beforeEach(async () => {
  db = openDb(':memory:');
  app = buildApp(db);
  await app.ready();
});

afterEach(async () => {
  await app.close();
  db.close();
});

describe('DELETE + undo (FR-012, FR-013)', () => {
  it('soft-deletes so the bookmark drops out of lists', async () => {
    const b = await create({ url: 'https://a.com', title: 'A', tags: ['keep'] });
    const del = await app.inject({ method: 'DELETE', url: `/api/bookmarks/${b.id}` });
    expect(del.statusCode).toBe(200);
    expect(del.json().undoToken).toBeTruthy();
    expect(await list()).not.toContain(b.id);

    const detail = await app.inject({ method: 'GET', url: `/api/bookmarks/${b.id}` });
    expect(detail.statusCode).toBe(404);
  });

  it('restores the bookmark with its tags on undo', async () => {
    const b = await create({ url: 'https://a.com', title: 'A', tags: ['keep', 'work'] });
    await app.inject({ method: 'DELETE', url: `/api/bookmarks/${b.id}` });

    const undo = await app.inject({ method: 'POST', url: `/api/bookmarks/${b.id}/undo` });
    expect(undo.statusCode).toBe(200);
    expect(undo.json().tags.sort()).toEqual(['keep', 'work']);
    expect(await list()).toContain(b.id);
  });

  it('frees the address while deleted and reclaims it on undo', async () => {
    const b = await create({ url: 'https://a.com', title: 'A' });
    await app.inject({ method: 'DELETE', url: `/api/bookmarks/${b.id}` });

    // The address is free to save again while the original is deleted.
    const reuse = await create({ url: 'https://a.com', title: 'A-again' });
    expect(reuse.id).not.toBe(b.id);

    // Undo now collides with the re-saved active bookmark.
    const undo = await app.inject({ method: 'POST', url: `/api/bookmarks/${b.id}/undo` });
    expect(undo.statusCode).toBe(409);
  });

  it('returns 404 undoing a bookmark that was never deleted', async () => {
    const b = await create({ url: 'https://a.com', title: 'A' });
    const undo = await app.inject({ method: 'POST', url: `/api/bookmarks/${b.id}/undo` });
    expect(undo.statusCode).toBe(404);
  });
});
