import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb, type DB } from '../../src/server/db/connection';
import { buildApp } from '../../src/server/app';

// US3: editing (incl. address collision), archive/restore, delete, and batch.

let db: DB;
let app: FastifyInstance;

beforeEach(async () => {
  db = openDb(':memory:');
  app = buildApp({ db, enrich: () => {} });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  db.close();
});

async function create(payload: Record<string, unknown>): Promise<number> {
  const res = await app.inject({ method: 'POST', url: '/api/bookmarks', payload });
  return res.json().bookmark.id;
}
function patch(id: number, payload: Record<string, unknown>) {
  return app.inject({ method: 'PATCH', url: `/api/bookmarks/${id}`, payload });
}

describe('PATCH address editing (FR-013/FR-023)', () => {
  it('changes the address', async () => {
    const id = await create({ url: 'https://old.com/' });
    const res = await patch(id, { url: 'https://new.com/' });
    expect(res.statusCode).toBe(200);
    expect(res.json().bookmark.url).toBe('https://new.com/');
  });

  it('returns 409 with the existing bookmark when the new address collides', async () => {
    const a = await create({ url: 'https://a.com/' });
    await create({ url: 'https://b.com/' });
    const res = await patch(a, { url: 'b.com' }); // collides with the second
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('duplicate_url');
    expect(res.json().existing.url).toBe('https://b.com/');
  });

  it('rejects a malformed new address (FR-002)', async () => {
    const id = await create({ url: 'https://a.com/' });
    const res = await patch(id, { url: 'not a url' });
    expect(res.statusCode).toBe(400);
  });
});

describe('archive / read-later flags (FR-015/FR-016)', () => {
  it('archives and restores, affecting which view a bookmark appears in', async () => {
    const id = await create({ url: 'https://a.com/' });
    await patch(id, { archived: true });
    let all = await app.inject({ method: 'GET', url: '/api/bookmarks?view=all' });
    expect(all.json().total).toBe(0); // hidden from main list
    const arch = await app.inject({ method: 'GET', url: '/api/bookmarks?view=archived' });
    expect(arch.json().total).toBe(1);

    await patch(id, { archived: false });
    all = await app.inject({ method: 'GET', url: '/api/bookmarks?view=all' });
    expect(all.json().total).toBe(1);
  });

  it('flags and clears read-later', async () => {
    const id = await create({ url: 'https://a.com/' });
    await patch(id, { readLater: true });
    const rl = await app.inject({ method: 'GET', url: '/api/bookmarks?view=readLater' });
    expect(rl.json().total).toBe(1);
    await patch(id, { readLater: false });
    const rl2 = await app.inject({ method: 'GET', url: '/api/bookmarks?view=readLater' });
    expect(rl2.json().total).toBe(0);
  });
});

describe('DELETE (FR-017)', () => {
  it('permanently removes a bookmark', async () => {
    const id = await create({ url: 'https://a.com/' });
    const del = await app.inject({ method: 'DELETE', url: `/api/bookmarks/${id}` });
    expect(del.statusCode).toBe(204);
    const got = await app.inject({ method: 'GET', url: `/api/bookmarks/${id}` });
    expect(got.statusCode).toBe(404);
  });
});

describe('batch actions (FR-019/FR-020)', () => {
  it('archives several at once', async () => {
    const a = await create({ url: 'https://a.com/' });
    const b = await create({ url: 'https://b.com/' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/bookmarks/batch',
      payload: { ids: [a, b], action: 'archive' },
    });
    expect(res.json()).toEqual({ updated: 2 });
    const all = await app.inject({ method: 'GET', url: '/api/bookmarks?view=all' });
    expect(all.json().total).toBe(0);
  });

  it('adds a tag to several at once', async () => {
    const a = await create({ url: 'https://a.com/' });
    const b = await create({ url: 'https://b.com/' });
    await app.inject({
      method: 'POST',
      url: '/api/bookmarks/batch',
      payload: { ids: [a, b], action: 'addTag', tag: 'Read' },
    });
    const tagged = await app.inject({ method: 'GET', url: '/api/bookmarks?tagsAll=read' });
    expect(tagged.json().total).toBe(2);
  });

  it('deletes several at once', async () => {
    const a = await create({ url: 'https://a.com/' });
    const b = await create({ url: 'https://b.com/' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/bookmarks/batch',
      payload: { ids: [a, b], action: 'delete' },
    });
    expect(res.json()).toEqual({ deleted: 2 });
  });

  it('rejects addTag without a tag', async () => {
    const a = await create({ url: 'https://a.com/' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/bookmarks/batch',
      payload: { ids: [a], action: 'addTag' },
    });
    expect(res.statusCode).toBe(400);
  });
});
