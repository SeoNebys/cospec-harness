import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/test-app.js';

describe('bookmark create/list API', () => {
  let testApp: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    testApp = createTestApp();
  });
  afterEach(() => testApp.close());

  it('creates, lists, and gets a bookmark', async () => {
    const created = await request(testApp.app)
      .post('/api/bookmarks')
      .send({ title: 'Example', url: 'https://example.com', notes: 'Useful' })
      .expect(201);
    expect(created.body).toMatchObject({ title: 'Example', notes: 'Useful', tags: [] });

    const listed = await request(testApp.app).get('/api/bookmarks').expect(200);
    expect(listed.body.total).toBe(1);
    expect(listed.body.items[0].id).toBe(created.body.id);

    await request(testApp.app)
      .get(`/api/bookmarks/${created.body.id}`)
      .expect(200)
      .expect(({ body }) => expect(body.title).toBe('Example'));
  });

  it('returns field errors for invalid input', async () => {
    const response = await request(testApp.app)
      .post('/api/bookmarks')
      .send({ title: '', url: 'ftp://example.com' })
      .expect(400);
    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Check the highlighted fields.',
    });
    expect(response.body.error.fieldErrors).toHaveProperty('title');
    expect(response.body.error.fieldErrors).toHaveProperty('url');
  });

  it('returns a 409 with the existing id for normalized duplicates', async () => {
    const first = await request(testApp.app)
      .post('/api/bookmarks')
      .send({ title: 'First', url: 'https://example.com/docs/' })
      .expect(201);
    const duplicate = await request(testApp.app)
      .post('/api/bookmarks')
      .send({ title: 'Again', url: 'HTTPS://EXAMPLE.COM:443/docs' })
      .expect(409);
    expect(duplicate.body.error).toMatchObject({
      code: 'DUPLICATE_URL',
      existingBookmarkId: first.body.id,
    });
  });

  it('returns not found for an unknown bookmark', async () => {
    await request(testApp.app)
      .get('/api/bookmarks/999')
      .expect(404)
      .expect(({ body }) => expect(body.error.code).toBe('NOT_FOUND'));
  });
});
