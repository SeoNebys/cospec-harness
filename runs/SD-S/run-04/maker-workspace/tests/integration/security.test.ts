import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { testApp } from '../helpers/app';
import { authenticated } from '../helpers/auth';
import { bookmarkInput } from '../helpers/bookmark-fixture';
describe('security boundaries', () => {
  const dbs: ReturnType<typeof testApp>['db'][] = [];
  afterEach(() => dbs.splice(0).forEach((db) => db.close()));
  it('hides one user bookmark from another and rejects foreign origins', async () => {
    const { app, db } = testApp();
    dbs.push(db);
    const a = await authenticated(app, 'a@example.com');
    const b = await authenticated(app, 'b@example.com');
    const id = (await a.post('/api/bookmarks').send(bookmarkInput()).expect(201)).body.id;
    await b.delete(`/api/bookmarks/${id}`).expect(404);
    const list = await b.get('/api/bookmarks?view=active').expect(200);
    expect(list.body.items).toHaveLength(0);
    await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://evil.example')
      .send({ email: 'c@example.com', password: 'correct horse battery staple' })
      .expect(403);
  });
});
