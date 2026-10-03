import { expect, it } from 'vitest';
import { buildApp } from '../../src/server/app';
import { temporaryDatabase } from '../fixtures/database';
it('uses contracted statuses and fields for bookmark creation', async () => {
  const fixture = temporaryDatabase();
  const app = await buildApp({ db: fixture.db });
  const response = await app.inject({
    method: 'POST',
    url: '/api/bookmarks',
    payload: { url: 'https://example.com/contract' },
  });
  expect(response.statusCode).toBe(201);
  expect(response.json()).toMatchObject({
    url: 'https://example.com/contract',
    title: 'contract — example.com',
    tags: [],
    lifecycleState: 'active',
    readingState: 'none',
    metadataStatus: 'fallback',
  });
  await app.close();
  fixture.close();
});
