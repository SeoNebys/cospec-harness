import { describe, it, expect } from 'vitest';
import { makeApp } from '../helpers.ts';

async function seed(app: ReturnType<typeof makeApp>['app']) {
  const mk = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/bookmarks', payload });
  await mk({ url: 'http://a.test/1', title: 'Quarterly Report', tags: ['work'], description: 'the budget' });
  await mk({ url: 'http://a.test/2', title: 'Summer recipes', tags: ['recipes'], note: 'rock and roll night' });
  await mk({ url: 'http://a.test/3', title: 'Work draft', tags: ['work'], description: 'a draft doc' });
  await mk({ url: 'http://a.test/4', title: 'Budget planning', tags: ['work'] });
}

function titles(res: { json: () => { items: { title: string }[] } }) {
  return res.json().items.map((i) => i.title).sort();
}

describe('advanced search (US3/US8)', () => {
  it('is case-insensitive and searches title/description/note/tags', async () => {
    const { app } = makeApp();
    await seed(app);
    const res = await app.inject({ method: 'GET', url: '/api/bookmarks?q=' + encodeURIComponent('BUDGET') });
    expect(titles(res)).toEqual(['Budget planning', 'Quarterly Report']);
  });

  it('combines #tag with text and boolean operators + parentheses', async () => {
    const { app } = makeApp();
    await seed(app);
    const q = encodeURIComponent('#work AND ("Quarterly Report" OR budget) NOT draft');
    const res = await app.inject({ method: 'GET', url: '/api/bookmarks?q=' + q });
    expect(titles(res)).toEqual(['Budget planning', 'Quarterly Report']);
  });

  it('treats quoted operators as literal words', async () => {
    const { app } = makeApp();
    await seed(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/bookmarks?q=' + encodeURIComponent('"rock and roll"'),
    });
    expect(titles(res)).toEqual(['Summer recipes']);
  });

  it('finds matches in the note field (FR-018)', async () => {
    const { app } = makeApp();
    await seed(app);
    const res = await app.inject({ method: 'GET', url: '/api/bookmarks?q=night' });
    expect(titles(res)).toEqual(['Summer recipes']);
  });

  it('returns 400 on a malformed query', async () => {
    const { app } = makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/bookmarks?q=' + encodeURIComponent('(a OR') });
    expect(res.statusCode).toBe(400);
  });
});
