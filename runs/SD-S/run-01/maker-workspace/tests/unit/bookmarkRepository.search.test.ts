import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/data/db';
import { add, list, listTags } from '../../src/data/bookmarkRepository';

beforeEach(async () => {
  await db.bookmarks.clear();
  await add({ url: 'https://react.dev', title: 'React docs', tags: ['dev', 'reading'] });
  await add({ url: 'https://nytimes.com', title: 'News', tags: ['reading'] });
  await add({ url: 'https://vitejs.dev', title: 'Vite', tags: ['dev'] });
});

describe('list with tag filter (FR-010)', () => {
  it('returns only bookmarks carrying the tag', async () => {
    const results = await list({ tag: 'dev' });
    expect(results.map((b) => b.title).sort()).toEqual(['React docs', 'Vite']);
  });
});

describe('list with keyword (FR-011)', () => {
  it('matches title, url, or tags case-insensitively', async () => {
    expect((await list({ keyword: 'react' })).map((b) => b.title)).toEqual(['React docs']);
    expect((await list({ keyword: 'nytimes' })).map((b) => b.title)).toEqual(['News']);
    expect((await list({ keyword: 'reading' })).map((b) => b.title).sort()).toEqual([
      'News',
      'React docs',
    ]);
  });

  it('combines tag and keyword with AND', async () => {
    const results = await list({ tag: 'dev', keyword: 'vite' });
    expect(results.map((b) => b.title)).toEqual(['Vite']);
  });

  it('returns empty when nothing matches', async () => {
    expect(await list({ keyword: 'nonexistent-term' })).toEqual([]);
  });
});

describe('listTags', () => {
  it('returns distinct tags sorted', async () => {
    expect(await listTags()).toEqual(['dev', 'reading']);
  });
});
