import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/test-app.js';

describe('bookmark mutation API', () => {
  let testApp: ReturnType<typeof createTestApp>;
  let id: number;

  beforeEach(async () => {
    testApp = createTestApp();
    const response = await request(testApp.app)
      .post('/api/bookmarks')
      .send({ title: 'Original', url: 'https://example.com/original', tags: ['Old'] });
    id = response.body.id as number;
  });
  afterEach(() => testApp.close());

  it('edits details and changes independent states', async () => {
    await request(testApp.app)
      .patch(`/api/bookmarks/${id}`)
      .send({ title: 'Edited', notes: 'Changed', tags: ['New'] })
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ title: 'Edited', tags: ['New'] }));
    await request(testApp.app)
      .patch(`/api/bookmarks/${id}`)
      .send({ isFavorite: true, isArchived: true })
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ isFavorite: true, isArchived: true }));
  });

  it('returns duplicate and validation errors on update', async () => {
    const other = await request(testApp.app)
      .post('/api/bookmarks')
      .send({ title: 'Other', url: 'https://example.com/other' });
    await request(testApp.app)
      .patch(`/api/bookmarks/${other.body.id}`)
      .send({ url: 'https://example.com/original/' })
      .expect(409)
      .expect(({ body }) => expect(body.error.existingBookmarkId).toBe(id));
    await request(testApp.app).patch(`/api/bookmarks/${id}`).send({}).expect(400);
  });

  it('permanently deletes and then returns not found', async () => {
    await request(testApp.app).delete(`/api/bookmarks/${id}`).expect(204);
    await request(testApp.app).get(`/api/bookmarks/${id}`).expect(404);
    await request(testApp.app).delete(`/api/bookmarks/${id}`).expect(404);
  });
});
