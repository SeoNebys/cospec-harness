import { afterEach, describe, expect, it } from 'vitest';
import { testApp } from '../helpers/app';
import { authenticated } from '../helpers/auth';
import { bookmarkInput } from '../helpers/bookmark-fixture';

describe('bookmark creation contract', () => {
  const databases: ReturnType<typeof testApp>['db'][] = [];
  afterEach(() => databases.splice(0).forEach((db) => db.close()));
  it('creates, warns on a duplicate, and accepts explicit continuation', async () => {
    const { app, db } = testApp();
    databases.push(db);
    const agent = await authenticated(app);
    const first = await agent.post('/api/bookmarks').send(bookmarkInput()).expect(201);
    expect(first.body.title).toBe('A useful article');
    const warning = await agent.post('/api/bookmarks').send(bookmarkInput()).expect(409);
    expect(warning.body.code).toBe('DUPLICATE_BOOKMARK');
    expect(warning.body.existingBookmark.id).toBe(first.body.id);
    await agent
      .post('/api/bookmarks')
      .send(bookmarkInput({ allowDuplicate: true }))
      .expect(201);
  });
  it('returns field validation without losing ownership boundaries', async () => {
    const { app, db } = testApp();
    databases.push(db);
    const agent = await authenticated(app);
    const response = await agent
      .post('/api/bookmarks')
      .send(bookmarkInput({ url: 'ftp://example.com' }))
      .expect(422);
    expect(response.body.issues[0].field).toBe('url');
  });
});
