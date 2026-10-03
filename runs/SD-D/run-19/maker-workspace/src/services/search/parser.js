// Recursive-descent parser producing a boolean AST.
// Precedence: NOT > AND > OR. Adjacent atoms are ANDed implicitly.
// AST nodes: {type:'and'|'or', left, right} | {type:'not', child}
//            {type:'term', value} | {type:'tag', value}
import { tokenize, SearchSyntaxError } from './tokenizer.js';

export function parseSearch(input) {
  const tokens = tokenize(input);
  if (tokens.length === 0) return null; // empty query matches everything

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr() { return parseOr(); }

  function parseOr() {
    let node = parseAnd();
    while (peek() && peek().type === 'op' && peek().value === 'OR') {
      next();
      const right = parseAnd();
      if (!right) throw new SearchSyntaxError('syntax', 'Missing term after OR');
      node = { type: 'or', left: node, right };
    }
    return node;
  }

  function parseAnd() {
    let node = parseNot();
    while (peek()) {
      const t = peek();
      if (t.type === 'op' && t.value === 'AND') {
        next();
        const right = parseNot();
        if (!right) throw new SearchSyntaxError('syntax', 'Missing term after AND');
        node = { type: 'and', left: node, right };
      } else if (t.type === 'term' || t.type === 'tag' || t.type === 'lparen' ||
                 (t.type === 'op' && t.value === 'NOT')) {
        // Implicit AND between adjacent atoms.
        const right = parseNot();
        if (!right) break;
        node = { type: 'and', left: node, right };
      } else {
        break;
      }
    }
    return node;
  }

  function parseNot() {
    const t = peek();
    if (t && t.type === 'op' && t.value === 'NOT') {
      next();
      const child = parseNot();
      if (!child) throw new SearchSyntaxError('syntax', 'Missing term after NOT');
      return { type: 'not', child };
    }
    return parseAtom();
  }

  function parseAtom() {
    const t = peek();
    if (!t) return null;
    if (t.type === 'lparen') {
      next();
      const node = parseExpr();
      const closing = next();
      if (!closing || closing.type !== 'rparen') {
        throw new SearchSyntaxError('unbalanced-paren', 'Unbalanced parenthesis in search query');
      }
      if (!node) throw new SearchSyntaxError('syntax', 'Empty group in search query');
      return node;
    }
    if (t.type === 'rparen') {
      throw new SearchSyntaxError('unbalanced-paren', 'Unbalanced parenthesis in search query');
    }
    if (t.type === 'op') {
      throw new SearchSyntaxError('syntax', `Unexpected operator ${t.value}`);
    }
    if (t.type === 'term') { next(); return { type: 'term', value: t.value }; }
    if (t.type === 'tag') { next(); return { type: 'tag', value: t.value }; }
    return null;
  }

  const ast = parseExpr();
  if (pos !== tokens.length) {
    const t = tokens[pos];
    if (t.type === 'rparen') throw new SearchSyntaxError('unbalanced-paren', 'Unbalanced parenthesis in search query');
    throw new SearchSyntaxError('syntax', 'Could not parse search query');
  }
  return ast;
}

export { SearchSyntaxError };
