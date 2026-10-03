import { describe, expect, it } from 'vitest';

import { SearchParseError, parseSearchQuery } from '../../src/shared/search/index.js';

describe('parseSearchQuery', () => {
  it('combines bare terms and exact phrases with implicit AND', () => {
    expect(parseSearchQuery('Rome "ancient Rome" history')).toEqual({
      type: 'and',
      clauses: [
        { type: 'text', value: 'rome', exact: false },
        { type: 'text', value: 'ancient rome', exact: true },
        { type: 'text', value: 'history', exact: false },
      ],
    });
  });

  it('parses exact tags and alternatives, case-insensitively', () => {
    expect(parseSearchQuery('TAG:"Science Fiction" tag:(Article | book | ARTICLE)')).toEqual({
      type: 'and',
      clauses: [
        { type: 'tagAny', values: ['science fiction'] },
        { type: 'tagAny', values: ['article', 'book'] },
      ],
    });
  });

  it('normalizes Unicode and removes repeated normalized clauses', () => {
    expect(parseSearchQuery('ＲＯＭＥ rome tag:Café tag:Cafe\u0301')).toEqual({
      type: 'and',
      clauses: [
        { type: 'text', value: 'rome', exact: false },
        { type: 'tagAny', values: ['café'] },
      ],
    });
  });

  it('supports quote, slash, and reserved-punctuation escapes', () => {
    expect(parseSearchQuery('"say \\"hello\\" \\\\ now" foo\\|bar')).toEqual({
      type: 'and',
      clauses: [
        { type: 'text', value: 'say "hello" \\ now', exact: true },
        { type: 'text', value: 'foo|bar', exact: false },
      ],
    });
  });

  it.each([
    ['"open', 'UNCLOSED_QUOTE'],
    ['tag:', 'EMPTY_TAG'],
    ['tag:()', 'EMPTY_GROUP'],
    ['tag:(book|)', 'MISSING_ALTERNATIVE'],
    ['rome)', 'UNEXPECTED_RPAREN'],
    ['rome\\x', 'INVALID_ESCAPE'],
  ] as const)('reports stable error information for %s', (raw, code) => {
    try {
      parseSearchQuery(raw);
      expect.fail('expected parse error');
    } catch (error) {
      expect(error).toBeInstanceOf(SearchParseError);
      expect(error).toMatchObject({ code });
      expect((error as SearchParseError).span.end).toBeGreaterThanOrEqual(
        (error as SearchParseError).span.start,
      );
    }
  });

  it('enforces raw length and syntactic clause limits', () => {
    expect(() => parseSearchQuery('x'.repeat(1_001))).toThrowError(
      expect.objectContaining({ code: 'QUERY_TOO_LONG', span: { start: 1_000, end: 1_001 } }),
    );
    expect(() => parseSearchQuery(Array.from({ length: 51 }, (_, index) => `x${index}`).join(' '))).toThrowError(
      expect.objectContaining({ code: 'TOO_MANY_CLAUSES' }),
    );
  });
});
