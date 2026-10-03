import { afterEach, describe, expect, it } from 'vitest';
import { testApp } from '../helpers/app';
import { authenticated } from '../helpers/auth';
import { bookmarkInput } from '../helpers/bookmark-fixture';
describe('bookmark mutation contract', () => {
  const dbs: ReturnType<typeof testApp>['db'][] = [];
  afterEach(() => dbs.splice(0).forEach((db) => db.close()));
  it('edits, favorites, archives, restores, and deletes', async () => {
    const { app, db } = testApp();
    dbs.push(db);
    const agent = await authenticated(app);
    const id = (await agent.post('/api/bookmarks').send(bookmarkInput()).expect(201)).body.id;
    expect(
      (
        await agent
          .patch(`/api/bookmarks/${id}`)
          .send(bookmarkInput({ title: 'Changed' }))
          .expect(200)
      ).body.title,
    ).toBe('Changed');
    expect(
      (await agent.put(`/api/bookmarks/${id}/favorite`).send({ isFavorite: true }).expect(200)).body
        .isFavorite,
    ).toBe(true);
    expect((await agent.post(`/api/bookmarks/${id}/archive`).expect(200)).body.status).toBe(
      'archived',
    );
    expect((await agent.post(`/api/bookmarks/${id}/restore`).expect(200)).body.status).toBe(
      'active',
    );
    await agent.delete(`/api/bookmarks/${id}`).expect(204);
    await agent.delete(`/api/bookmarks/${id}`).expect(404);
  });
});
