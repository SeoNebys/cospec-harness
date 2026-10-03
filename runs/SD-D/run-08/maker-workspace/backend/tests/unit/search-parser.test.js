import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/search/tokenizer.js';
import { parseQuery } from '../../src/search/parser.js';

// Helper: collapse an AST into a compact string for assertions.
function s(node) {
  if (!node) return '∅';
  switch (node.op) {
    case 'term':
      return node.term.type === 'tag' ? `#${node.term.value}` : `"${node.term.value}"`;
    case 'and':
      return `(${s(node.left)} AND ${s(node.right)})`;
    case 'or':
      return `(${s(node.left)} OR ${s(node.right)})`;
    case 'not':
      return `NOT ${s(node.child)}`;
    default:
      return '?';
  }
}

describe('tokenizer', () => {
  it('recognizes operators case-insensitively', () => {
    expect(tokenize('a AND b').map((t) => t.type)).toEqual(['word', 'and', 'word']);
    expect(tokenize('a and b').map((t) => t.type)).toEqual(['word', 'and', 'word']);
    expect(tokenize('a Or b nOt c').map((t) => t.type)).toEqual([
      'word', 'or', 'word', 'not', 'word',
    ]);
  });
  it('treats operator words inside quotes as literal text (FR-017c)', () => {
    const toks = tokenize('"and then"');
    expect(toks).toEqual([{ type: 'phrase', value: 'and then' }]);
  });
  it('parses #tag terms', () => {
    expect(tokenize('#work')).toEqual([{ type: 'tag', value: 'work' }]);
  });
  it('throws on unbalanced quotes', () => {
    expect(() => tokenize('"open')).toThrow();
  });
});

describe('parser', () => {
  it('implicit AND between a keyword and a #tag (FR-017a)', () => {
    expect(s(parseQuery('report #work'))).toBe('("report" AND #work)');
  });
  it('explicit OR makes alternatives', () => {
    expect(s(parseQuery('report OR #work'))).toBe('("report" OR #work)');
  });
  it('quoted phrase term', () => {
    expect(s(parseQuery('"machine learning"'))).toBe('"machine learning"');
  });
  it('NOT binds tighter than AND, AND tighter than OR', () => {
    expect(s(parseQuery('a OR b AND NOT c'))).toBe('("a" OR ("b" AND NOT "c"))');
  });
  it('parentheses override precedence', () => {
    expect(s(parseQuery('(#work OR #research) AND report'))).toBe(
      '((#work OR #research) AND "report")'
    );
  });
  it('mixed-case operators behave identically', () => {
    expect(s(parseQuery('a and b'))).toBe(s(parseQuery('a AND b')));
  });
  it('empty query yields no constraint', () => {
    expect(parseQuery('   ')).toBeNull();
  });

  it('rejects malformed queries', () => {
    expect(() => parseQuery('(a AND b')).toThrow(); // unbalanced parens
    expect(() => parseQuery('a AND')).toThrow(); // missing operand
    expect(() => parseQuery('OR a')).toThrow(); // leading operator
    expect(() => parseQuery('"unbalanced')).toThrow(); // unbalanced quote
  });
});
