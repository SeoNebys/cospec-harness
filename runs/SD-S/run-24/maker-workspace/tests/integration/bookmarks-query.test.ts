import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BookmarkRepository } from '../../src/server/repositories/bookmark-repository.js';
import { createTestApp } from '../helpers/test-app.js';

describe('bookmark query API', () => {
  let testApp: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    testApp = createTestApp();
    const repository = new BookmarkRepository(testApp.db);
    repository.create({
      title: 'Alpha',
      url: 'https://example.com/alpha',
      notes: 'Needle punctuation: 100%',
      tags: ['One', 'Shared'],
    });
    repository.create({
      title: 'Beta',
      url: 'https://example.com/beta',
      notes: 'Another',
      tags: ['Two', 'Shared'],
    });
  });
  afterEach(() => testApp.close());

  it('combines literal search, match-all tags, and sorting', async () => {
    const response = await request(testApp.app)
      .get('/api/bookmarks?q=100%25&tags=one,shared&sort=title')
      .expect(200);
    expect(response.body.items.map((item: { title: string }) => item.title)).toEqual(['Alpha']);
  });

  it('lists active tag counts', async () => {
    const response = await request(testApp.app).get('/api/tags').expect(200);
    expect(response.body.items).toEqual([
      { name: 'One', bookmarkCount: 1 },
      { name: 'Shared', bookmarkCount: 2 },
      { name: 'Two', bookmarkCount: 1 },
    ]);
  });

  it.each(['archived=maybe', 'favorite=1', 'sort=random'])(
    'rejects invalid query %s',
    async (query) => {
      await request(testApp.app)
        .get(`/api/bookmarks?${query}`)
        .expect(400)
        .expect(({ body }) => expect(body.error.code).toBe('INVALID_QUERY'));
    },
  );
});
