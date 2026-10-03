import { describe, it, expect } from 'vitest';
import { parse, SearchSyntaxError } from '../../server/services/search/parser.js';
import { compileQuery } from '../../server/services/search/evaluate.js';

// Helper: make a bookmark-like object for evaluation.
const bm = (over = {}) => ({
  title: '',
  url: '',
  description: '',
  note_text: '',
  tags: [],
  ...over,
});

describe('search parser precedence', () => {
  it('binds NOT tighter than AND, and AND tighter than OR', () => {
    // a OR b AND NOT c  ==  a OR (b AND (NOT c))
    const tree = parse('a OR b AND NOT c');
    expect(tree.op).toBe('or');
    expect(tree.left).toEqual({ op: 'term', value: 'a' });
    expect(tree.right.op).toBe('and');
    expect(tree.right.right.op).toBe('not');
  });

  it('parentheses override precedence', () => {
    const tree = parse('(a OR b) AND c');
    expect(tree.op).toBe('and');
    expect(tree.left.op).toBe('or');
  });

  it('treats adjacent terms as implicit AND', () => {
    const tree = parse('a b');
    expect(tree.op).toBe('and');
  });
});

describe('search evaluation', () => {
  it('matches case-insensitively across fields', () => {
    const pred = compileQuery('Release');
    expect(pred(bm({ description: 'the RELEASE notes' }))).toBe(true);
    expect(pred(bm({ title: 'nothing' }))).toBe(false);
  });

  it('applies the pinned example correctly', () => {
    const pred = compileQuery('#work AND ("release notes" OR changelog) NOT draft');
    const match = bm({ title: 'The release notes', tags: ['work'] });
    const draft = bm({ title: 'release notes draft', tags: ['work'] });
    const noTag = bm({ title: 'release notes', tags: ['home'] });
    expect(pred(match)).toBe(true);
    expect(pred(draft)).toBe(false); // excluded by NOT draft
    expect(pred(noTag)).toBe(false); // missing #work
  });

  it('matches a quoted operator word literally', () => {
    const pred = compileQuery('"AND"');
    expect(pred(bm({ title: 'cats and dogs' }))).toBe(true);
    expect(pred(bm({ title: 'cats or dogs' }))).toBe(false);
  });

  it('restricts #tag to tags, not free text', () => {
    const pred = compileQuery('#news');
    expect(pred(bm({ tags: ['news'] }))).toBe(true);
    expect(pred(bm({ title: 'news of the day', tags: [] }))).toBe(false);
  });

  it('throws on unbalanced parentheses', () => {
    expect(() => parse('(a OR b')).toThrow(SearchSyntaxError);
    expect(() => parse('a)')).toThrow(SearchSyntaxError);
  });
});
