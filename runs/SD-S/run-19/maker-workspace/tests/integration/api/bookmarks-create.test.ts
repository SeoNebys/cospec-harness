import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BookmarkDatabase } from '../../../src/server/db/client.js';
import { openDatabase } from '../../../src/server/db/client.js';
import { createApp } from '../../../src/server/app.js';
import type { MetadataPreview } from '../../../src/shared/types.js';

let database: BookmarkDatabase;

beforeEach(() => { database = openDatabase(':memory:'); });
afterEach(() => database.close());

describe('save and list API', () => {
  it('returns editable metadata and persists a bookmark newest-first', async () => {
    const metadataFetcher = { preview: async (url: string): Promise<MetadataPreview> => ({
      url, normalizedUrl: url, title: 'Fetched title', description: 'Fetched description', source: 'remote', warning: null,
    }) };
    const app = createApp({ database, staticDirectory: false, metadataFetcher });
    await request(app).post('/api/metadata').send({ url: 'https://example.com/' }).expect(200).expect(({ body }) => {
      expect(body.title).toBe('Fetched title');
    });
    const saved = await request(app).post('/api/bookmarks').send({ url: 'https://example.com/', title: 'My title', description: 'Edited', tags: [] }).expect(201);
    const list = await request(app).get('/api/bookmarks').expect(200);
    expect(list.body).toMatchObject({ total: 1, items: [{ id: saved.body.id, title: 'My title', description: 'Edited' }] });
  });

  it('requires explicit duplicate confirmation', async () => {
    const app = createApp({ database, staticDirectory: false });
    const body = { url: 'https://example.com', title: 'One', tags: [] };
    await request(app).post('/api/bookmarks').send(body).expect(201);
    await request(app).post('/api/bookmarks').send({ ...body, title: 'Two' }).expect(409).expect(({ body: responseBody }) => {
      expect(responseBody.error.code).toBe('DUPLICATE_URL');
      expect(responseBody.duplicates).toHaveLength(1);
    });
    await request(app).post('/api/bookmarks').send({ ...body, title: 'Two', allowDuplicate: true }).expect(201);
  });

  it('returns actionable validation errors', async () => {
    const app = createApp({ database, staticDirectory: false });
    await request(app).post('/api/metadata').send({ url: 'file:///tmp/test' }).expect(422).expect(({ body }) => expect(body.error.code).toBe('INVALID_URL'));
    await request(app).post('/api/bookmarks').send({ url: 'not a URL', title: '', tags: [] }).expect(422);
  });
});
