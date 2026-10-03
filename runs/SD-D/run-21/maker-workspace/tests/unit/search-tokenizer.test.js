import { describe, it, expect } from 'vitest';
import { tokenize, SearchSyntaxError } from '../../server/services/search/tokenizer.js';

describe('search tokenizer', () => {
  it('tokenizes bare terms', () => {
    expect(tokenize('hello world')).toEqual([
      { type: 'term', value: 'hello' },
      { type: 'term', value: 'world' },
    ]);
  });

  it('recognizes operators case-insensitively', () => {
    expect(tokenize('a AND b or c NOT d').map((t) => t.type)).toEqual([
      'term', 'and', 'term', 'or', 'term', 'not', 'term',
    ]);
  });

  it('treats quoted operator words as literal phrases', () => {
    expect(tokenize('"AND"')).toEqual([{ type: 'phrase', value: 'AND' }]);
  });

  it('parses #tag tokens and quoted phrases', () => {
    expect(tokenize('#work "release notes"')).toEqual([
      { type: 'tag', value: 'work' },
      { type: 'phrase', value: 'release notes' },
    ]);
  });

  it('emits parentheses', () => {
    expect(tokenize('(a)').map((t) => t.type)).toEqual(['lparen', 'term', 'rparen']);
  });

  it('throws on an unbalanced quote', () => {
    expect(() => tokenize('"unterminated')).toThrow(SearchSyntaxError);
  });
});
