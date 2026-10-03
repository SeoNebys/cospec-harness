import { describe, expect, it } from 'vitest';

import { createBookmarkSchema, updateBookmarkSchema } from './bookmark-schema.js';

describe('bookmark schemas', () => {
  it('trims values and supplies optional defaults', () => {
    expect(
      createBookmarkSchema.parse({ title: '  Example  ', url: ' https://example.com ' }),
    ).toEqual({ title: 'Example', url: 'https://example.com', notes: '', tags: [] });
  });

  it.each([
    [{ title: '', url: 'https://example.com' }, 'Title'],
    [{ title: 'x'.repeat(201), url: 'https://example.com' }, '200'],
    [{ title: 'Example', url: 'ftp://example.com' }, 'HTTP'],
    [{ title: 'Example', url: `https://example.com/${'x'.repeat(2030)}` }, '2,048'],
    [{ title: 'Example', url: 'https://example.com', notes: 'x'.repeat(5001) }, '5,000'],
    [{ title: 'Example', url: 'https://example.com', tags: Array(21).fill('tag') }, '20'],
    [{ title: 'Example', url: 'https://example.com', tags: ['x'.repeat(41)] }, '40'],
  ])('rejects invalid create input %#', (input, message) => {
    expect(() => createBookmarkSchema.parse(input)).toThrow(String(message));
  });

  it('requires at least one update field', () => {
    expect(() => updateBookmarkSchema.parse({})).toThrow('at least one change');
  });
});
