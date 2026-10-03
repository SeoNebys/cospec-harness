import { describe, expect, it } from 'vitest';
import { distinctTags, normalizeTag } from '../../src/server/bookmarks/tag-normalization';

describe('tag normalization', () => {
  it('folds case and whitespace', () => expect(normalizeTag('  Web   Design ')).toBe('web design'));
  it('deduplicates visual variants', () =>
    expect(distinctTags(['Ideas', ' ideas ', 'IDEAS'])).toEqual(['Ideas']));
});
