import { describe, it, expect } from 'vitest';
import { makeApp } from '../helpers.ts';

describe('POST /api/bookmarks (US1)', () => {
  it('persists all provided fields incl. tags and unread, returns 201', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: {
        url: 'example.com/page',
        title: 'My Title',
        description: 'My description',
        note: '# Note\n\n- point',
        tags: ['Work', 'reading'],
        unread: true,
      },
    });
    expect(res.statusCode).toBe(201);
    const b = res.json();
    expect(b.url).toBe('http://example.com/page');
    expect(b.title).toBe('My Title');
    expect(b.description).toBe('My description');
    expect(b.note).toContain('# Note');
    expect(b.unread).toBe(true);
    expect(b.tags.sort()).toEqual(['reading', 'work']);
    expect(b.captureStatus.metadata).toBe('pending');
  });

  it('rejects an invalid address with 400', async () => {
    const { app } = makeApp();
    const res = await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url: '   ' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('bad_request');
  });

  it('derives a display title when no title given (no successful capture)', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: { url: 'http://derive.test/some/path' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().title).toBe('derive.test/some/path');
  });
});
