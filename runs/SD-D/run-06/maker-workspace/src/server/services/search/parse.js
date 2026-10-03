// Recursive-descent parser producing a boolean AST (FR-013/FR-013a/FR-013b).
//
// Precedence: NOT > AND > OR. Adjacent terms with no explicit operator combine
// with an implicit AND (FR-013a). Grouping via parentheses.
//
// AST nodes:
//   { type: 'and', left, right }
//   { type: 'or', left, right }
//   { type: 'not', child }
//   { type: 'term', value }   text term matched across address/title/description/notes/tags
//   { type: 'tag', value }    tag membership match

import { tokenize, SearchSyntaxError } from './tokenize.js';

const TERM_START = new Set(['word', 'phrase', 'tag', 'not', 'lparen']);

export function parseQuery(input) {
  const tokens = tokenize(input);
  if (tokens.length === 0) return null; // empty query -> no constraint

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr() {
    let node = parseAnd();
    while (peek() && peek().type === 'or') {
      next();
      const right = parseAnd();
      node = { type: 'or', left: node, right };
    }
    return node;
  }

  function parseAnd() {
    let node = parseNot();
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.type === 'and') {
        next();
        const right = parseNot();
        node = { type: 'and', left: node, right };
      } else if (TERM_START.has(t.type)) {
        // implicit AND between adjacent terms
        const right = parseNot();
        node = { type: 'and', left: node, right };
      } else {
        break; // 'or', 'rparen', or end
      }
    }
    return node;
  }

  function parseNot() {
    if (peek() && peek().type === 'not') {
      next();
      return { type: 'not', child: parseNot() };
    }
    return parseAtom();
  }

  function parseAtom() {
    const t = peek();
    if (!t) throw new SearchSyntaxError('Unexpected end of query');

    if (t.type === 'lparen') {
      next();
      const inner = parseOr();
      const close = next();
      if (!close || close.type !== 'rparen') {
        throw new SearchSyntaxError('Missing closing parenthesis');
      }
      if (inner === null) throw new SearchSyntaxError('Empty group');
      return inner;
    }
    if (t.type === 'word' || t.type === 'phrase') {
      next();
      return { type: 'term', value: t.value };
    }
    if (t.type === 'tag') {
      next();
      return { type: 'tag', value: t.value };
    }
    throw new SearchSyntaxError(`Unexpected "${t.type}" in query`);
  }

  const ast = parseOr();
  if (pos < tokens.length) {
    throw new SearchSyntaxError('Unexpected token after query');
  }
  return ast;
}

export { SearchSyntaxError };
