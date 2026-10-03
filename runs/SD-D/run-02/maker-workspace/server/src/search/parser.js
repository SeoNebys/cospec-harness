// Recursive-descent parser for the search grammar.
// Precedence (high -> low): NOT > AND (incl. implicit adjacency) > OR.
// Returns an AST, or null for an empty query (matches everything).
//
// AST nodes:
//   { type: 'word'|'phrase', value }
//   { type: 'tag', value }
//   { type: 'not', child }
//   { type: 'and'|'or', left, right }

import { tokenize, SearchError } from './tokenizer.js';

export { SearchError };

export function parseQuery(input) {
  const tokens = tokenize(input);
  if (tokens.length === 0) return null;
  const p = new Parser(tokens);
  const ast = p.parseOr();
  if (!p.atEnd()) {
    throw new SearchError('Unexpected input in search near the end.');
  }
  return ast;
}

const OPERAND_STARTS = new Set(['word', 'phrase', 'tag', 'not', 'lparen']);

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos];
  }
  next() {
    return this.tokens[this.pos++];
  }
  atEnd() {
    return this.pos >= this.tokens.length;
  }

  parseOr() {
    let left = this.parseAnd();
    while (!this.atEnd() && this.peek().type === 'or') {
      this.next();
      const right = this.parseAnd();
      left = { type: 'or', left, right };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseUnary();
    while (!this.atEnd()) {
      const t = this.peek();
      if (t.type === 'and') {
        this.next();
        const right = this.parseUnary();
        left = { type: 'and', left, right };
      } else if (OPERAND_STARTS.has(t.type)) {
        // Implicit AND by adjacency (e.g. "#js promise").
        const right = this.parseUnary();
        left = { type: 'and', left, right };
      } else {
        break;
      }
    }
    return left;
  }

  parseUnary() {
    if (!this.atEnd() && this.peek().type === 'not') {
      this.next();
      const child = this.parseUnary();
      return { type: 'not', child };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const t = this.peek();
    if (!t) {
      throw new SearchError('Search ends with an incomplete expression.');
    }
    if (t.type === 'lparen') {
      this.next();
      const inner = this.parseOr();
      const close = this.peek();
      if (!close || close.type !== 'rparen') {
        throw new SearchError('Unbalanced parentheses in search.');
      }
      this.next();
      if (inner == null) {
        throw new SearchError('Empty parentheses in search.');
      }
      return inner;
    }
    if (t.type === 'rparen') {
      throw new SearchError('Unbalanced parentheses in search.');
    }
    if (t.type === 'and' || t.type === 'or') {
      throw new SearchError(`Search cannot start with "${t.type.toUpperCase()}".`);
    }
    if (t.type === 'word' || t.type === 'phrase') {
      this.next();
      return { type: t.type, value: t.value };
    }
    if (t.type === 'tag') {
      this.next();
      return { type: 'tag', value: t.value };
    }
    throw new SearchError('Unexpected token in search.');
  }
}
