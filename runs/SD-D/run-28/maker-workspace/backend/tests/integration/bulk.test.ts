import { describe, it, expect } from 'vitest';
import { makeApp } from '../helpers.ts';

describe('bulk actions (US9) with saved-view parity (FR-019)', () => {
  it('applies a saved view (query + include/exclude tags) to the FULL matching set', async () => {
    const { app } = makeApp();
    const mk = (payload: Record<string, unknown>) =>
      app.inject({ method: 'POST', url: '/api/bookmarks', payload });

    // Matches the view: tagged work, text "report", not draft.
    await mk({ url: 'http://v.test/1', title: 'Annual report', tags: ['work'] });
    await mk({ url: 'http://v.test/2', title: 'Monthly report', tags: ['work'] });
    // Excluded by NOT draft / include tag / query.
    await mk({ url: 'http://v.test/3', title: 'Report draft', tags: ['work', 'draft'] });
    await mk({ url: 'http://v.test/4', title: 'Home report', tags: ['home'] });

    const view = (
      await app.inject({
        method: 'POST',
        url: '/api/views',
        payload: { name: 'Work reports', query: 'report', includeTags: ['work'], excludeTags: ['draft'] },
      })
    ).json();

    // The list under the view shows exactly 2.
    const listed = (await app.inject({ method: 'GET', url: `/api/bookmarks?view=${view.id}` })).json();
    expect(listed.total).toBe(2);

    // Bulk add a tag to everything matching the view (select-all-matching).
    const bulk = await app.inject({
      method: 'POST',
      url: '/api/bookmarks/bulk',
      payload: { selector: { match: { view: view.id } }, action: { type: 'addTags', tags: ['reviewed'] } },
    });
    expect(bulk.json().affected).toBe(2);

    const reviewed = (await app.inject({ method: 'GET', url: '/api/bookmarks?tag=reviewed' })).json();
    expect(reviewed.total).toBe(2);
    // The draft and the home report must NOT have been touched.
    expect(reviewed.items.map((i: { title: string }) => i.title).sort()).toEqual([
      'Annual report',
      'Monthly report',
    ]);
  });

  it('supports id-based selection and bulk delete/archive', async () => {
    const { app } = makeApp();
    const a = (await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url: 'http://b.test/1' } })).json();
    const b = (await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url: 'http://b.test/2' } })).json();

    const arch = await app.inject({
      method: 'POST',
      url: '/api/bookmarks/bulk',
      payload: { selector: { ids: [a.id] }, action: { type: 'archive', archived: true } },
    });
    expect(arch.json().affected).toBe(1);
    expect((await app.inject({ method: 'GET', url: '/api/bookmarks' })).json().total).toBe(1);

    const del = await app.inject({
      method: 'POST',
      url: '/api/bookmarks/bulk',
      payload: { selector: { ids: [a.id, b.id] }, action: { type: 'delete' } },
    });
    expect(del.json().affected).toBe(2);
    expect((await app.inject({ method: 'GET', url: '/api/bookmarks?scope=all' })).json().total).toBe(0);
  });
});
