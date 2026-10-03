import { tokenize, SearchSyntaxError } from './tokenizer.js';

// Recursive-descent parser producing an expression tree.
// Precedence (lowest to highest): OR, AND, NOT, primary.
// Adjacent operands with no operator are combined with implicit AND (FR-009).
// Parentheses override precedence.

const PRIMARY_STARTS = new Set(['term', 'phrase', 'tag', 'not', 'lparen']);

export function parse(input) {
  const tokens = tokenize(input);
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr() {
    let node = parseAnd();
    while (peek() && peek().type === 'or') {
      next();
      const right = parseAnd();
      if (!right) throw new SearchSyntaxError('Missing term after OR.');
      node = { op: 'or', left: node, right };
    }
    return node;
  }

  function parseAnd() {
    let node = parseNot();
    while (peek()) {
      const t = peek().type;
      if (t === 'and') {
        next();
        const right = parseNot();
        if (!right) throw new SearchSyntaxError('Missing term after AND.');
        node = { op: 'and', left: node, right };
      } else if (PRIMARY_STARTS.has(t)) {
        // Implicit AND between adjacent operands.
        const right = parseNot();
        if (!right) break;
        node = { op: 'and', left: node, right };
      } else {
        break;
      }
    }
    return node;
  }

  function parseNot() {
    if (peek() && peek().type === 'not') {
      next();
      const child = parseNot();
      if (!child) throw new SearchSyntaxError('Missing term after NOT.');
      return { op: 'not', child };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();
    if (!t) return null;
    if (t.type === 'lparen') {
      next();
      const inner = parseOr();
      const close = next();
      if (!close || close.type !== 'rparen') {
        throw new SearchSyntaxError('Unbalanced parenthesis in search query.');
      }
      if (!inner) throw new SearchSyntaxError('Empty parentheses in search query.');
      return inner;
    }
    if (t.type === 'rparen') {
      throw new SearchSyntaxError('Unbalanced parenthesis in search query.');
    }
    if (t.type === 'term' || t.type === 'phrase') {
      next();
      return { op: 'term', value: t.value };
    }
    if (t.type === 'tag') {
      next();
      return { op: 'tag', value: t.value };
    }
    return null;
  }

  const tree = parseOr();
  if (pos < tokens.length) {
    // Leftover tokens (e.g. an unmatched ')').
    throw new SearchSyntaxError('Unbalanced parenthesis in search query.');
  }
  return tree; // null when the query is empty
}

export { SearchSyntaxError };
