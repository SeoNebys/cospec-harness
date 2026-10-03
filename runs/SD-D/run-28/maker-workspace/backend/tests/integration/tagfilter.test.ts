import { describe, it, expect } from 'vitest';
import { makeApp } from '../helpers.ts';

describe('tag filtering + suggestions (US7)', () => {
  it('filters by tag[] param and via #tag, and suggests used tags', async () => {
    const { app } = makeApp();
    await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url: 'http://t.test/1', tags: ['work', 'urgent'] } });
    await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url: 'http://t.test/2', tags: ['home'] } });

    const byParam = (await app.inject({ method: 'GET', url: '/api/bookmarks?tag=work' })).json();
    expect(byParam.total).toBe(1);

    const byHash = (await app.inject({ method: 'GET', url: '/api/bookmarks?q=%23home' })).json();
    expect(byHash.total).toBe(1);

    const suggest = (await app.inject({ method: 'GET', url: '/api/tags?prefix=w' })).json();
    expect(suggest.tags.map((t: { name: string }) => t.name)).toContain('work');
  });
});
