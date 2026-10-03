import { afterEach, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app';
import { temporaryDatabase } from '../fixtures/database';
import { fixtureTransport } from '../fixtures/metadata';
const cleanup: Array<() => void> = [];
afterEach(() => cleanup.splice(0).forEach((value) => value()));
it('previews, edits, saves, retrieves, lists, persists and rejects duplicates', async () => {
  const fixture = temporaryDatabase();
  cleanup.push(fixture.close);
  const app = await buildApp({ db: fixture.db, fetcher: fixtureTransport });
  const preview = await app.inject({
    method: 'POST',
    url: '/api/metadata-previews',
    payload: { url: 'https://example.com/story' },
  });
  expect(preview.statusCode).toBe(200);
  expect(preview.json().title).toBe('Fixture title');
  const saved = await app.inject({
    method: 'POST',
    url: '/api/bookmarks',
    payload: {
      url: 'https://example.com/story',
      metadataPreviewId: preview.json().id,
      title: 'Edited title',
      tagLabels: ['Research'],
      readingState: 'unread',
    },
  });
  expect(saved.statusCode).toBe(201);
  expect(saved.json()).toMatchObject({ title: 'Edited title', readingState: 'unread' });
  expect((await app.inject(`/api/bookmarks/${saved.json().id}`)).json().tags[0].label).toBe('Research');
  expect((await app.inject('/api/bookmarks?view=unread&q=%23research')).json().total).toBe(1);
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        payload: { url: 'https://EXAMPLE.com:443/story#again' },
      })
    ).statusCode,
  ).toBe(409);
  await app.close();
});
