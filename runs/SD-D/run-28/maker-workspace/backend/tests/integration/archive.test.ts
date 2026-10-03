import { describe, it, expect } from 'vitest';
import { makeApp } from '../helpers.ts';

describe('archive + read-later scopes (US5/US6)', () => {
  it('excludes archived from active list/search and shows them in archived scope', async () => {
    const { app } = makeApp();
    const a = (await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url: 'http://s.test/a', title: 'Keep' } })).json();
    (await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url: 'http://s.test/b', title: 'Hide' } })).json();

    // Archive the second (find it by list).
    const list = (await app.inject({ method: 'GET', url: '/api/bookmarks' })).json();
    const hide = list.items.find((i: { title: string }) => i.title === 'Hide');
    await app.inject({ method: 'PATCH', url: `/api/bookmarks/${hide.id}`, payload: { archived: true } });

    const active = (await app.inject({ method: 'GET', url: '/api/bookmarks' })).json();
    expect(active.items.map((i: { title: string }) => i.title)).toEqual(['Keep']);

    const archived = (await app.inject({ method: 'GET', url: '/api/bookmarks?scope=archived' })).json();
    expect(archived.items.map((i: { title: string }) => i.title)).toEqual(['Hide']);

    // Default search excludes archived too.
    const search = (await app.inject({ method: 'GET', url: '/api/bookmarks?q=Hide' })).json();
    expect(search.total).toBe(0);

    // unread scope.
    await app.inject({ method: 'PATCH', url: `/api/bookmarks/${a.id}`, payload: { unread: true } });
    const unread = (await app.inject({ method: 'GET', url: '/api/bookmarks?scope=unread' })).json();
    expect(unread.items.map((i: { title: string }) => i.title)).toEqual(['Keep']);
  });
});
