import { describe, it, expect } from 'vitest';
import { makeApp } from '../helpers.ts';

describe('duplicate save (US2)', () => {
  it('returns 409 with existingId and creates no duplicate for variant addresses', async () => {
    const { app } = makeApp();
    const first = await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: { url: 'http://Example.com/path' },
    });
    const id = first.json().id;

    for (const variant of ['http://example.com/path/', 'Example.com/path', 'http://example.com/path']) {
      const res = await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url: variant } });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.details.existingId).toBe(id);
    }

    const list = await app.inject({ method: 'GET', url: '/api/bookmarks' });
    expect(list.json().total).toBe(1);
  });
});
