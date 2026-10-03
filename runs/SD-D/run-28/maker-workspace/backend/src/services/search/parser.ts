import { badRequest } from '../../lib/errors.ts';

// AST for the advanced search grammar (contracts/search-grammar.md).
export type Ast =
  | { type: 'and'; left: Ast; right: Ast }
  | { type: 'or'; left: Ast; right: Ast }
  | { type: 'not'; expr: Ast }
  | { type: 'text'; value: string; phrase: boolean }
  | { type: 'tag'; name: string };

type Token =
  | { t: 'lparen' }
  | { t: 'rparen' }
  | { t: 'and' }
  | { t: 'or' }
  | { t: 'not' }
  | { t: 'phrase'; value: string }
  | { t: 'tag'; value: string }
  | { t: 'word'; value: string };

/** Tokenize. Operators are recognized ONLY when unquoted (FR-012a). */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input;
  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ t: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ t: 'rparen' });
      i++;
      continue;
    }
    if (ch === '"') {
      // Quoted phrase: operators inside are literal words.
      let j = i + 1;
      let value = '';
      let closed = false;
      while (j < s.length) {
        if (s[j] === '"') {
          closed = true;
          break;
        }
        value += s[j];
        j++;
      }
      if (!closed) throw badRequest('Unbalanced quote in search query.');
      tokens.push({ t: 'phrase', value: value.trim() });
      i = j + 1;
      continue;
    }
    if (ch === '#') {
      let j = i + 1;
      let value = '';
      while (j < s.length && !/[\s()"]/.test(s[j])) {
        value += s[j];
        j++;
      }
      if (!value) throw badRequest('Empty #tag in search query.');
      tokens.push({ t: 'tag', value });
      i = j;
      continue;
    }
    // Bareword: read until whitespace/paren/quote.
    let j = i;
    let value = '';
    while (j < s.length && !/[\s()"]/.test(s[j])) {
      value += s[j];
      j++;
    }
    i = j;
    const lower = value.toLowerCase();
    if (lower === 'and') tokens.push({ t: 'and' });
    else if (lower === 'or') tokens.push({ t: 'or' });
    else if (lower === 'not') tokens.push({ t: 'not' });
    else tokens.push({ t: 'word', value });
  }
  return tokens;
}

/**
 * Recursive-descent parser. Precedence: NOT > AND (incl. implicit) > OR.
 * Returns null for an empty query.
 */
export function parseQuery(input: string): Ast | null {
  const tokens = tokenize(input ?? '');
  if (tokens.length === 0) return null;

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr(): Ast {
    let left = parseAnd();
    while (peek() && peek().t === 'or') {
      next();
      const right = parseAnd();
      left = { type: 'or', left, right };
    }
    return left;
  }

  function parseAnd(): Ast {
    let left = parseNot();
    while (peek()) {
      const tk = peek();
      if (tk.t === 'and') {
        next();
        const right = parseNot();
        left = { type: 'and', left, right };
      } else if (tk.t === 'or' || tk.t === 'rparen') {
        break;
      } else {
        // Implicit AND between adjacent terms.
        const right = parseNot();
        left = { type: 'and', left, right };
      }
    }
    return left;
  }

  function parseNot(): Ast {
    if (peek() && peek().t === 'not') {
      next();
      return { type: 'not', expr: parseNot() };
    }
    return parseTerm();
  }

  function parseTerm(): Ast {
    const tk = next();
    if (!tk) throw badRequest('Unexpected end of search query.');
    switch (tk.t) {
      case 'lparen': {
        const inner = parseOr();
        const close = next();
        if (!close || close.t !== 'rparen') {
          throw badRequest('Unbalanced parentheses in search query.');
        }
        return inner;
      }
      case 'phrase':
        if (!tk.value) throw badRequest('Empty quoted phrase in search query.');
        return { type: 'text', value: tk.value, phrase: true };
      case 'tag':
        return { type: 'tag', name: tk.value };
      case 'word':
        return { type: 'text', value: tk.value, phrase: false };
      case 'and':
      case 'or':
      case 'not':
        throw badRequest(`Misplaced operator "${tk.t.toUpperCase()}" in search query.`);
      case 'rparen':
        throw badRequest('Unbalanced parentheses in search query.');
      default:
        throw badRequest('Invalid search query.');
    }
  }

  const ast = parseOr();
  if (pos !== tokens.length) {
    throw badRequest('Unbalanced parentheses in search query.');
  }
  return ast;
}
