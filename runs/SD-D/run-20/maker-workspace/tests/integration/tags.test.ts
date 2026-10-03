import { expect, it } from 'vitest';
import { buildApp } from '../../src/server/app';
import { temporaryDatabase } from '../fixtures/database';
it('reuses normalized tags and suggests prefix before substring with exclusions', async () => {
  const fixture = temporaryDatabase();
  const app = await buildApp({ db: fixture.db });
  const first = (
    await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: {
        url: 'https://example.com/a',
        tagLabels: [' Product   Design ', 'Design Research', 'Research Design'],
      },
    })
  ).json();
  const second = (
    await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: { url: 'https://example.com/b', tagLabels: ['product design'] },
    })
  ).json();
  expect(first.tags.find((tag: { label: string }) => tag.label === 'Product Design').id).toBe(
    second.tags[0].id,
  );
  const suggestions = (await app.inject('/api/tags?suggest=design')).json().items;
  expect(suggestions[0].label).toBe('Design Research');
  expect(
    (await app.inject(`/api/tags?suggest=product&excludeBookmarkId=${second.id}`)).json().items,
  ).toHaveLength(0);
  await app.close();
  fixture.close();
});
