import { describe, it, expect } from 'vitest';
import { makeApp } from '../helpers.ts';

describe('descriptions and notes (US8)', () => {
  it('persists description + markdown note across reads and makes them searchable', async () => {
    const { app } = makeApp();
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/bookmarks',
        payload: { url: 'http://n.test/1', description: 'a special description', note: '## Heading\n\nsome *markdown* memo' },
      })
    ).json();

    const got = (await app.inject({ method: 'GET', url: `/api/bookmarks/${created.id}` })).json();
    expect(got.description).toBe('a special description');
    expect(got.note).toContain('## Heading');

    const byDesc = (await app.inject({ method: 'GET', url: '/api/bookmarks?q=special' })).json();
    expect(byDesc.total).toBe(1);
    const byNote = (await app.inject({ method: 'GET', url: '/api/bookmarks?q=memo' })).json();
    expect(byNote.total).toBe(1);
  });
});
