import { expect, it } from 'vitest';
import { buildApp } from '../../src/server/app';
import { temporaryDatabase } from '../fixtures/database';
it('combines Boolean search, tag filters, views and stable sorting', async () => {
  const fixture = temporaryDatabase();
  const app = await buildApp({ db: fixture.db });
  for (const payload of [
    {
      url: 'https://example.com/a',
      title: 'Design systems',
      description: 'Research handbook',
      tagLabels: ['Product Design'],
    },
    {
      url: 'https://example.com/b',
      title: 'Garden notes',
      description: 'Design debt',
      tagLabels: ['Finished'],
    },
  ])
    await app.inject({ method: 'POST', url: '/api/bookmarks', payload });
  expect((await app.inject('/api/bookmarks?q=%22design%20systems%22')).json().total).toBe(1);
  expect((await app.inject('/api/bookmarks?q=design%20AND%20NOT%20%22design%20debt%22')).json().total).toBe(
    1,
  );
  expect((await app.inject('/api/bookmarks?q=%23%22product%20design%22')).json().total).toBe(1);
  expect((await app.inject('/api/bookmarks?sort=title&direction=asc')).json().items[0].title).toBe(
    'Design systems',
  );
  const invalid = await app.inject('/api/bookmarks?q=design%20AND');
  expect(invalid.statusCode).toBe(422);
  expect(invalid.json()).toMatchObject({ code: 'INVALID_SEARCH_QUERY', query: 'design AND' });
  await app.close();
  fixture.close();
});
