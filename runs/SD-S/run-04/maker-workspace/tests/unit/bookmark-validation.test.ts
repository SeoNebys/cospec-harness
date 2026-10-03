import { describe, expect, it } from 'vitest';
import { bookmarkInputSchema } from '../../src/shared/contracts/bookmarks';

describe('bookmark validation', () => {
  it('accepts complete HTTP input', () =>
    expect(
      bookmarkInputSchema.parse({
        url: 'https://example.com',
        title: 'Title',
        notes: '',
        tags: [],
        isFavorite: false,
      }).title,
    ).toBe('Title'));
  it('rejects unsupported schemes and field limits', () => {
    expect(() =>
      bookmarkInputSchema.parse({
        url: 'file:///etc/passwd',
        title: 'x',
        notes: '',
        tags: [],
        isFavorite: false,
      }),
    ).toThrow();
    expect(() =>
      bookmarkInputSchema.parse({
        url: 'https://example.com',
        title: 'x'.repeat(301),
        notes: '',
        tags: [],
        isFavorite: false,
      }),
    ).toThrow();
  });
});
