import { describe, expect, it } from 'vitest';
import { createBookmarkSchema, metadataPreviewSchema, updateBookmarkSchema } from '../../../src/shared/schemas.js';

describe('shared schemas', () => {
  it('trims fields and converts an empty description to null', () => {
    const parsed = createBookmarkSchema.parse({ url: ' https://example.com ', title: ' Example ', description: ' ', tags: [] });
    expect(parsed).toMatchObject({ url: 'https://example.com', title: 'Example', description: null, allowDuplicate: false });
  });

  it('enforces field and collection limits', () => {
    expect(() => createBookmarkSchema.parse({ url: 'x'.repeat(2049), title: 'x', tags: [] })).toThrow();
    expect(() => createBookmarkSchema.parse({ url: 'https://example.com', title: 'x'.repeat(301), tags: [] })).toThrow();
    expect(() => createBookmarkSchema.parse({ url: 'https://example.com', title: 'x', tags: Array(21).fill('tag') })).toThrow();
  });

  it('requires an actual update field', () => {
    expect(() => updateBookmarkSchema.parse({ allowDuplicate: true })).toThrow();
  });

  it('accepts both metadata result sources', () => {
    expect(metadataPreviewSchema.parse({
      url: 'https://example.com/', normalizedUrl: 'https://example.com/', title: 'Example', description: null, source: 'fallback', warning: 'Unavailable',
    }).source).toBe('fallback');
  });
});
