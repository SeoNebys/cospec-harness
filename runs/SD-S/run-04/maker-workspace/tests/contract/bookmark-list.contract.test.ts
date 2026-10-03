import { afterEach, describe, expect, it } from 'vitest';
import { testApp } from '../helpers/app';
import { authenticated } from '../helpers/auth';
import { bookmarkInput } from '../helpers/bookmark-fixture';

describe('bookmark list contract', () => {
  const dbs: ReturnType<typeof testApp>['db'][] = [];
  afterEach(() => dbs.splice(0).forEach((db) => db.close()));
  it('searches fields and intersects tags with favorite', async () => {
    const { app, db } = testApp();
    dbs.push(db);
    const agent = await authenticated(app);
    await agent
      .post('/api/bookmarks')
      .send(
        bookmarkInput({
          title: 'Ocean typography',
          notes: 'serif research',
          tags: ['Design', 'Reading'],
          isFavorite: true,
        }),
      )
      .expect(201);
    await agent
      .post('/api/bookmarks')
      .send(
        bookmarkInput({
          url: 'https://example.org/other',
          title: 'Other',
          tags: ['Design'],
          allowDuplicate: true,
        }),
      )
      .expect(201);
    const tags = (await agent.get('/api/tags?view=active').expect(200)).body.items;
    const ids = tags.map((tag: { id: string }) => tag.id);
    const response = await agent
      .get(`/api/bookmarks?view=active&q=serif&favorite=true&tag=${ids[0]}&tag=${ids[1]}`)
      .expect(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].title).toBe('Ocean typography');
  });
});
