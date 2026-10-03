import { expect, it } from 'vitest';
import { buildApp } from '../../src/server/app';
import { temporaryDatabase } from '../fixtures/database';
it('turns blocked private metadata locations into a safe recoverable fallback', async () => {
  const fixture = temporaryDatabase();
  const app = await buildApp({ db: fixture.db });
  const response = await app.inject({
    method: 'POST',
    url: '/api/metadata-previews',
    payload: { url: 'http://127.0.0.1/private' },
  });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ status: 'skipped' });
  expect(response.json().warnings.some((item: { code: string }) => item.code === 'FETCH_BLOCKED')).toBe(true);
  await app.close();
  fixture.close();
});
