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

async function patch(id: number, payload: Record<string, unknown>) {
  return app.inject({ method: 'PATCH', url: `/api/bookmarks/${id}`, payload });
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

describe('PATCH /api/bookmarks/:id (FR-011)', () => {
  it('updates title and description and persists them', async () => {
    const b = await create({ url: 'https://a.com', title: 'Old' });
    const res = await patch(b.id, { title: 'New', description: 'notes' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBe('New');
    expect(body.description).toBe('notes');

    const reread = (await app.inject({ method: 'GET', url: `/api/bookmarks/${b.id}` })).json();
    expect(reread.title).toBe('New');
  });

  it('bumps updatedAt when edited', async () => {
    const b = await create({ url: 'https://a.com', title: 'A' });
    const res = await patch(b.id, { title: 'B' });
    expect(res.json().updatedAt >= b.updatedAt).toBe(true);
  });

  it('re-validates the url when changed', async () => {
    const b = await create({ url: 'https://a.com', title: 'A' });
    const res = await patch(b.id, { url: 'not a url' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_url');
  });

  it('rejects a url change that collides with another active bookmark', async () => {
    await create({ url: 'https://taken.com', title: 'Taken' });
    const b = await create({ url: 'https://free.com', title: 'Free' });
    const res = await patch(b.id, { url: 'https://taken.com' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('duplicate');
  });

  it('allows saving the same url unchanged (not a self-duplicate)', async () => {
    const b = await create({ url: 'https://a.com', title: 'A' });
    const res = await patch(b.id, { url: 'https://a.com', title: 'A2' });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('A2');
  });

  it('returns 404 for a missing bookmark', async () => {
    const res = await patch(9999, { title: 'x' });
    expect(res.statusCode).toBe(404);
  });
});
