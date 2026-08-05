import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb, type DB } from '../../src/server/db';
import { buildApp } from '../../src/server/app';

let db: DB;
let app: FastifyInstance;

async function create(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/bookmarks', payload });
}

async function count() {
  const res = await app.inject({ method: 'GET', url: '/api/bookmarks' });
  return (res.json().bookmarks as unknown[]).length;
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

describe('Duplicate handling (FR-014, SC-006)', () => {
  it('returns 409 with the existing bookmark and creates no duplicate', async () => {
    const first = (await create({ url: 'https://dup.com', title: 'First' })).json();

    const res = await create({ url: 'https://dup.com', title: 'Second' });
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error).toBe('duplicate');
    expect(body.existing.id).toBe(first.id);
    expect(body.existing.title).toBe('First');

    // No second bookmark was created.
    expect(await count()).toBe(1);
  });

  it('treats case and whitespace differences as the same address', async () => {
    await create({ url: 'https://Example.com/page', title: 'A' });
    const res = await create({ url: '  HTTPS://example.COM/page  ', title: 'B' });
    expect(res.statusCode).toBe(409);
    expect(await count()).toBe(1);
  });

  it('treats different paths as distinct addresses', async () => {
    await create({ url: 'https://example.com/one', title: 'One' });
    const res = await create({ url: 'https://example.com/two', title: 'Two' });
    expect(res.statusCode).toBe(201);
    expect(await count()).toBe(2);
  });
});
