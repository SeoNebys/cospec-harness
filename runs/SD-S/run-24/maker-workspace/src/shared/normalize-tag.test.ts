import { describe, expect, it } from 'vitest';

import { normalizeTag, normalizeTags } from './normalize-tag.js';

describe('normalizeTag', () => {
  it('normalizes Unicode, whitespace, and case for identity', () => {
    expect(normalizeTag('  Ｗｅｂ   Design  ')).toEqual({
      name: 'Web Design',
      normalizedName: 'web design',
    });
  });

  it('keeps the first display spelling and collapses duplicates', () => {
    expect(normalizeTags(['Research', ' research ', 'READING'])).toEqual([
      { name: 'Research', normalizedName: 'research' },
      { name: 'READING', normalizedName: 'reading' },
    ]);
  });

  it('rejects empty, overlong, and excessive tags', () => {
    expect(() => normalizeTag('   ')).toThrow('between 1 and 40');
    expect(() => normalizeTag('x'.repeat(41))).toThrow('between 1 and 40');
    expect(() => normalizeTags(Array.from({ length: 21 }, (_, index) => `tag-${index}`))).toThrow(
      'no more than 20',
    );
  });
});
