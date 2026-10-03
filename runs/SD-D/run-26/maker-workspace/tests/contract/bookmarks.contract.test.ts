import { describe, expect, it } from 'vitest';
import { testApp } from '../helpers/http.js';
describe('bookmark API contract', () => {
  it('creates, lists, updates, and permanently deletes a bookmark', async () => {
    const t = await testApp();
    const created = await t.agent
      .post('/api/bookmarks')
      .set('X-CSRF-Token', t.csrf)
      .send({
        url: 'https://example.com',
        title: 'Contract',
        noteMarkdown: '',
        tags: [],
        isRead: false
      })
      .expect(201);
    const id = created.body.id;
    expect((await t.agent.get('/api/bookmarks?collection=active').expect(200)).body.total).toBe(1);
    await t.agent
      .patch(`/api/bookmarks/${id}`)
      .set('X-CSRF-Token', t.csrf)
      .send({ isRead: true })
      .expect(200);
    await t.agent
      .delete(`/api/bookmarks/${id}?confirm=permanent`)
      .set('X-CSRF-Token', t.csrf)
      .expect(204);
    t.cleanup();
  });
});
