import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb, type DB } from '../../src/server/db/connection';
import { buildApp } from '../../src/server/app';

// US2: searching and tag filtering via GET /api/bookmarks, plus GET /api/tags.
// No enrichment (offline) so titles/descriptions are exactly what we set.

let db: DB;
let app: FastifyInstance;

beforeEach(async () => {
  db = openDb(':memory:');
  app = buildApp({ db, enrich: () => {} });
  await app.ready();
  // Seed a small collection with tags and known text.
  const seed = [
    {
      url: 'https://a.com/',
      title: 'Pasta Bake',
      notes: 'a hearty dinner',
      tags: ['recipes', 'dinner'],
    },
    {
      url: 'https://b.com/',
      title: 'Chocolate Tart',
      notes: 'sweet',
      tags: ['recipes', 'dessert'],
    },
    { url: 'https://c.com/', title: 'Quick Salad', notes: 'light lunch', tags: ['recipes'] },
    {
      url: 'https://d.com/',
      title: 'Tax Guide',
      notes: 'annual budget spreadsheet',
      tags: ['finance'],
    },
  ];
  for (const s of seed) {
    await app.inject({ method: 'POST', url: '/api/bookmarks', payload: s });
  }
});

afterEach(async () => {
  await app.close();
  db.close();
});

async function search(query: string): Promise<string[]> {
  const res = await app.inject({ method: 'GET', url: `/api/bookmarks${query}` });
  return res.json().bookmarks.map((b: { title: string }) => b.title);
}

describe('GET /api/bookmarks — text search (FR-009/FR-010)', () => {
  it('matches a term case-insensitively across fields', async () => {
    expect(await search('?text=CHOCOLATE')).toEqual(['Chocolate Tart']);
    expect(await search('?text=dinner')).toEqual(['Pasta Bake']); // from notes
  });

  it('matches an exact quoted phrase', async () => {
    const withPhrase = await search('?text=' + encodeURIComponent('"budget spreadsheet"'));
    expect(withPhrase).toEqual(['Tax Guide']);
    // The same words out of order as a phrase should not match.
    const wrongOrder = await search('?text=' + encodeURIComponent('"spreadsheet budget"'));
    expect(wrongOrder).toEqual([]);
  });
});

describe('GET /api/bookmarks — tag filters (FR-011)', () => {
  it('any-of returns union', async () => {
    const r = await search('?tagsAny=dinner&tagsAny=dessert');
    expect(r.sort()).toEqual(['Chocolate Tart', 'Pasta Bake'].sort());
  });

  it('all-of returns intersection', async () => {
    expect(await search('?tagsAll=recipes&tagsAll=dinner')).toEqual(['Pasta Bake']);
  });

  it('excluding removes matches (worked example: recipes, not dessert)', async () => {
    const r = await search('?tagsAny=recipes&tagsNot=dessert');
    expect(r.sort()).toEqual(['Pasta Bake', 'Quick Salad'].sort());
    expect(r).not.toContain('Chocolate Tart');
  });

  it('the full worked example: (recipes OR dinner) but not dessert', async () => {
    const r = await search('?tagsAny=recipes&tagsAny=dinner&tagsNot=dessert');
    expect(r.sort()).toEqual(['Pasta Bake', 'Quick Salad'].sort());
  });
});

describe('GET /api/bookmarks — text and tags stack (AND)', () => {
  it('combines the text query with a tag filter (intersection)', async () => {
    // "recipes" text-matches all four titles/notes contain the word? Use a term
    // that hits several, then narrow by tag.
    const textOnly = await search('?text=recipes'); // note: only Tax Guide lacks it
    // Narrow "recipes"-ish by requiring the dinner tag → only Pasta Bake.
    const combined = await search('?text=Pasta&tagsAny=dinner');
    expect(combined).toEqual(['Pasta Bake']);
    expect(textOnly.length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/bookmarks — sort (FR-014)', () => {
  it('sorts by title', async () => {
    expect(await search('?sort=title')).toEqual([
      'Chocolate Tart',
      'Pasta Bake',
      'Quick Salad',
      'Tax Guide',
    ]);
  });
});

describe('GET /api/tags (FR-012)', () => {
  it('returns distinct tags with counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tags' });
    const tags: Array<{ name: string; count: number }> = res.json().tags;
    const recipes = tags.find((t) => t.name === 'recipes');
    expect(recipes?.count).toBe(3);
    expect(tags.map((t) => t.name).sort()).toEqual(
      ['dessert', 'dinner', 'finance', 'recipes'].sort()
    );
  });
});
