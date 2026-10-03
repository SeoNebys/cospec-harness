import { describe, it, expect } from 'vitest';
import { parseQuery, type Ast } from '../../src/services/search/parser.ts';

function shape(ast: Ast | null): unknown {
  if (!ast) return null;
  switch (ast.type) {
    case 'text':
      return { text: ast.value, phrase: ast.phrase };
    case 'tag':
      return { tag: ast.name };
    case 'not':
      return { not: shape(ast.expr) };
    case 'and':
      return { and: [shape(ast.left), shape(ast.right)] };
    case 'or':
      return { or: [shape(ast.left), shape(ast.right)] };
  }
}

describe('parseQuery', () => {
  it('treats adjacent terms as implicit AND', () => {
    expect(shape(parseQuery('budget report'))).toEqual({
      and: [{ text: 'budget', phrase: false }, { text: 'report', phrase: false }],
    });
  });

  it('parses a quoted phrase with operators as literal words', () => {
    expect(shape(parseQuery('"rock and roll"'))).toEqual({
      text: 'rock and roll',
      phrase: true,
    });
  });

  it('recognizes #tag and combines with text under boolean logic', () => {
    expect(shape(parseQuery('#work AND report'))).toEqual({
      and: [{ tag: 'work' }, { text: 'report', phrase: false }],
    });
  });

  it('honors precedence NOT > AND > OR and parentheses', () => {
    expect(shape(parseQuery('a OR b AND c'))).toEqual({
      or: [{ text: 'a', phrase: false }, { and: [{ text: 'b', phrase: false }, { text: 'c', phrase: false }] }],
    });
    expect(shape(parseQuery('(a OR b) AND c'))).toEqual({
      and: [{ or: [{ text: 'a', phrase: false }, { text: 'b', phrase: false }] }, { text: 'c', phrase: false }],
    });
    expect(shape(parseQuery('NOT draft'))).toEqual({ not: { text: 'draft', phrase: false } });
  });

  it('rejects malformed queries', () => {
    expect(() => parseQuery('"unbalanced')).toThrow();
    expect(() => parseQuery('(a OR b')).toThrow();
    expect(() => parseQuery('a AND')).toThrow();
  });

  it('returns null for empty query', () => {
    expect(parseQuery('   ')).toBeNull();
  });
});
