import { afterEach, describe, expect, it } from 'vitest';
import { testApp } from '../helpers/app';
import { authenticated } from '../helpers/auth';

describe('title preview contract', () => {
  const dbs: ReturnType<typeof testApp>['db'][] = [];
  afterEach(() => dbs.splice(0).forEach((db) => db.close()));
  it('requires authentication and blocks private destinations', async () => {
    const { app, db } = testApp();
    dbs.push(db);
    const agent = await authenticated(app);
    const response = await agent
      .post('/api/title-previews')
      .send({ url: 'http://127.0.0.1/private' })
      .expect(200);
    expect(response.body).toEqual({
      status: 'unavailable',
      title: null,
      reason: 'blocked_destination',
    });
  });
});
