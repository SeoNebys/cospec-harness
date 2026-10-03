import { describe, it, expect } from 'vitest';
import { parse, SearchSyntaxError } from '../../src/server/services/search/parser.js';
import { evaluate } from '../../src/server/services/search/evaluate.js';

// Helper: parse then evaluate against a synthetic bookmark.
function match(query, bookmark) {
  return evaluate(parse(query), bookmark);
}

const bm = (over = {}) => ({
  title: 'React Hooks tutorial',
  description: 'A guide to invoice workflows',
  note: 'this AND that matters',
  url: 'https://example.com/react',
  tags: ['frontend', 'work', 'tutorial'],
  ...over,
});

describe('search parser + grammar contract', () => {
  it('implicit AND between words', () => {
    expect(match('react hooks', bm())).toBe(true);
    expect(match('react missingword', bm())).toBe(false);
  });

  it('exact quoted phrase', () => {
    expect(match('"react hooks"', bm())).toBe(true);
    expect(match('"hooks react"', bm())).toBe(false);
  });

  it('OR operator', () => {
    expect(match('react OR vue', bm())).toBe(true);
    expect(match('angular OR vue', bm())).toBe(false);
  });

  it('#tag membership and NOT', () => {
    expect(match('#frontend NOT #archived', bm())).toBe(true);
    expect(match('#frontend NOT #work', bm())).toBe(false);
  });

  it('text + #tag requires BOTH (implicit AND)', () => {
    expect(match('invoice #work', bm())).toBe(true);
    expect(match('invoice #missing', bm())).toBe(false);
    expect(match('missingtext #work', bm())).toBe(false);
  });

  it('parentheses grouping', () => {
    expect(match('(react OR vue) #tutorial', bm())).toBe(true);
    expect(match('(angular OR vue) #tutorial', bm())).toBe(false);
  });

  it('quoted operator words are literals, not operators', () => {
    expect(match('"this AND that"', bm())).toBe(true);
    expect(match('"this AND other"', bm())).toBe(false);
  });

  it('NOT with substring', () => {
    expect(match('react NOT gym', bm())).toBe(true);
    expect(match('react NOT invoice', bm())).toBe(false);
  });

  it('empty query matches all', () => {
    expect(match('', bm())).toBe(true);
    expect(match('   ', bm())).toBe(true);
  });

  it('throws SearchSyntaxError on malformed queries', () => {
    expect(() => parse('react OR')).toThrow(SearchSyntaxError);
    expect(() => parse('"unterminated')).toThrow(SearchSyntaxError);
    expect(() => parse('(a OR b')).toThrow(SearchSyntaxError);
    expect(() => parse('NOT')).toThrow(SearchSyntaxError);
    expect(() => parse('a AND')).toThrow(SearchSyntaxError);
  });
});
