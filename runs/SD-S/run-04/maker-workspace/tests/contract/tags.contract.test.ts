import { afterEach, describe, expect, it } from 'vitest';
import { testApp } from '../helpers/app';
import { authenticated } from '../helpers/auth';
import { bookmarkInput } from '../helpers/bookmark-fixture';
describe('tag contract', () => {
  const dbs: ReturnType<typeof testApp>['db'][] = [];
  afterEach(() => dbs.splice(0).forEach((db) => db.close()));
  it('normalizes variants and reports lifecycle counts', async () => {
    const { app, db } = testApp();
    dbs.push(db);
    const agent = await authenticated(app);
    await agent
      .post('/api/bookmarks')
      .send(bookmarkInput({ tags: ['Ideas', ' ideas '] }))
      .expect(201);
    const response = await agent.get('/api/tags?view=active').expect(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].bookmarkCount).toBe(1);
  });
});
