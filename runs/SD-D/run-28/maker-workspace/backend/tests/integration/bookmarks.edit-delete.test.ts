import { describe, it, expect } from 'vitest';
import { makeApp } from '../helpers.ts';

describe('edit and delete (US4)', () => {
  it('edits fields, relinks tags, and re-checks duplicates on url change', async () => {
    const { app } = makeApp();
    const a = (await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url: 'http://x.test/a' } })).json();
    const b = (await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url: 'http://x.test/b' } })).json();

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/bookmarks/${a.id}`,
      payload: { title: 'Edited', tags: ['t1', 't2'] },
    });
    expect(patched.json().title).toBe('Edited');
    expect(patched.json().tags.sort()).toEqual(['t1', 't2']);

    // Changing a.url to b.url must conflict.
    const conflict = await app.inject({
      method: 'PATCH',
      url: `/api/bookmarks/${a.id}`,
      payload: { url: 'http://x.test/b' },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.details.existingId).toBe(b.id);
  });

  it('deletes permanently', async () => {
    const { app } = makeApp();
    const a = (await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url: 'http://del.test/a' } })).json();
    const del = await app.inject({ method: 'DELETE', url: `/api/bookmarks/${a.id}` });
    expect(del.statusCode).toBe(204);
    const get = await app.inject({ method: 'GET', url: `/api/bookmarks/${a.id}` });
    expect(get.statusCode).toBe(404);
  });
});
