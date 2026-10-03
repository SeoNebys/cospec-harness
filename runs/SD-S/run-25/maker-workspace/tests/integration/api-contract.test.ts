import request from 'supertest';

import { createApp } from '../../src/server/app.js';
import { BookmarkRepository } from '../../src/server/db/bookmark-repository.js';
import { registerBookmarkRoutes } from '../../src/server/routes/bookmarks.js';
import { registerMetadataRoutes } from '../../src/server/routes/metadata.js';
import { registerTagRoutes } from '../../src/server/routes/tags.js';
import { BookmarkService } from '../../src/server/services/bookmark-service.js';
import { createDeterministicClock, createDeterministicUuidFactory } from '../fixtures/bookmarks.js';
import { createTemporaryDatabase } from '../fixtures/database.js';

describe('OpenAPI HTTP contract', () => {
  it('covers every operation and its documented success envelope', async () => {
    const fixture = createTemporaryDatabase();
    try {
      const service = new BookmarkService(
        new BookmarkRepository(fixture.database, {
          now: createDeterministicClock(),
          createId: createDeterministicUuidFactory(),
        }),
      );
      const app = createApp({
        registerRoutes: (instance) => {
          registerBookmarkRoutes(instance, { bookmarkService: service });
          registerTagRoutes(instance, service);
          registerMetadataRoutes(instance, {
            metadataService: {
              preview: async (url) => ({
                requestedUrl: url,
                finalUrl: url,
                outcome: 'complete',
                title: 'Page title',
                description: 'Page description',
              }),
            },
          });
        },
      });

      expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok' });
      const create = await request(app).post('/api/bookmarks').send({
        url: 'https://example.com/contract',
        title: 'Contract bookmark',
        tags: ['Contract'],
        readingState: 'untracked',
      });
      expect(create.status).toBe(201);
      const id = create.body.id as string;
      expect((await request(app).get(`/api/bookmarks/${id}`)).body).toEqual(create.body);
      expect((await request(app).get('/api/bookmarks')).body).toMatchObject({ total: 1 });

      const state = await request(app)
        .patch(`/api/bookmarks/${id}/reading-state`)
        .send({ readingState: 'to_read' });
      expect(state.body.readingState).toBe('to_read');
      expect((await request(app).get('/api/bookmarks?view=read-later')).body.total).toBe(1);
      expect((await request(app).get('/api/tags')).body).toEqual({
        items: [{ name: 'Contract', normalizedName: 'contract', bookmarkCount: 1 }],
      });

      const replace = await request(app).put(`/api/bookmarks/${id}`).send({
        url: 'https://example.com/updated',
        title: 'Updated contract bookmark',
        tags: ['Updated'],
        readingState: 'read',
      });
      expect(replace.status).toBe(200);
      expect(replace.body).toMatchObject({ id, readingState: 'read' });

      const metadata = await request(app)
        .post('/api/page-metadata')
        .send({ url: 'https://example.com/page' });
      expect(metadata.status).toBe(200);
      expect(metadata.body).toMatchObject({ outcome: 'complete', title: 'Page title' });

      expect((await request(app).delete(`/api/bookmarks/${id}`)).status).toBe(204);
      expect((await request(app).get('/api/bookmarks')).body).toEqual({ items: [], total: 0 });
    } finally {
      fixture.cleanup();
    }
  });

  it('returns structured validation, duplicate, missing, JSON, size, and route errors', async () => {
    const fixture = createTemporaryDatabase();
    try {
      const service = new BookmarkService(new BookmarkRepository(fixture.database));
      const app = createApp({
        registerRoutes: (instance) => registerBookmarkRoutes(instance, { bookmarkService: service }),
      });
      const invalid = await request(app).post('/api/bookmarks').send({ url: 'file:///no', title: '' });
      expect(invalid.status).toBe(422);
      expect(invalid.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });

      const input = { url: 'https://example.com/same', title: 'Same' };
      expect((await request(app).post('/api/bookmarks').send(input)).status).toBe(201);
      const duplicate = await request(app).post('/api/bookmarks').send(input);
      expect(duplicate.status).toBe(409);
      expect(duplicate.body).toMatchObject({
        error: { code: 'DUPLICATE_URL' },
        existingBookmark: { title: 'Same' },
      });

      const missing = await request(app).get(
        '/api/bookmarks/00000000-0000-4000-8000-000000000999',
      );
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('BOOKMARK_NOT_FOUND');

      const badJson = await request(app)
        .post('/api/bookmarks')
        .set('content-type', 'application/json')
        .send('{');
      expect(badJson.status).toBe(400);
      expect(badJson.body.error.code).toBe('INVALID_JSON');

      const oversized = await request(app)
        .post('/api/bookmarks')
        .send({ url: 'https://example.com', title: 'x'.repeat(40_000) });
      expect(oversized.status).toBe(413);
      expect(oversized.body.error.code).toBe('PAYLOAD_TOO_LARGE');

      const unknown = await request(app).get('/api/not-an-operation');
      expect(unknown.status).toBe(404);
      expect(unknown.body.error.code).toBe('NOT_FOUND');
      expect(unknown.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      fixture.cleanup();
    }
  });
});
