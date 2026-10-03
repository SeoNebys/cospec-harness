import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app';
import { migrate } from '../../src/server/db/migrate';
import { temporaryDatabase } from '../fixtures/database';

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
describe('foundation', () => {
  it('migrates idempotently and reports ready with security headers', async () => {
    const fixture = temporaryDatabase();
    cleanups.push(fixture.close);
    migrate(fixture.db);
    expect(
      (fixture.db.prepare('select count(*) count from schema_migrations').get() as { count: number }).count,
    ).toBe(2);
    const app = await buildApp({ db: fixture.db });
    const response = await app.inject('/api/health');
    expect(response.json()).toEqual({ status: 'ready' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    await app.close();
  });
  it('returns structured validation errors', async () => {
    const fixture = temporaryDatabase();
    cleanups.push(fixture.close);
    const app = await buildApp({ db: fixture.db });
    const response = await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url: 'bad' } });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'INVALID_URL' });
    await app.close();
  });
});
