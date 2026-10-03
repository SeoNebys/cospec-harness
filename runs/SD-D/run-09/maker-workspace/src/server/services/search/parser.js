// Search query parser → boolean AST, per contracts/search-grammar.md.
//
// Grammar (precedence high→low): ( ) > NOT > AND (incl. implicit) > OR
// - bare word            → substring term
// - "quoted phrase"      → literal phrase; AND/OR/NOT inside quotes are literals
// - #tag                 → tag membership
// - AND / OR / NOT       → operators only when UNQUOTED (any case)
//
// AST nodes:
//   { term: 'word'|'phrase', value }
//   { term: 'tag', value }
//   { op: 'not', child }
//   { op: 'and'|'or', left, right }
// An empty query parses to null (matches everything).

export class SearchSyntaxError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SearchSyntaxError';
  }
}

function tokenize(input) {
  const tokens = [];
  const s = String(input || '');
  let i = 0;
  const isBreak = (c) => c === ' ' || c === '\t' || c === '\n' || c === '(' || c === ')';
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      i += 1;
      continue;
    }
    if (c === '(') {
      tokens.push({ type: 'LPAREN' });
      i += 1;
      continue;
    }
    if (c === ')') {
      tokens.push({ type: 'RPAREN' });
      i += 1;
      continue;
    }
    if (c === '"') {
      i += 1;
      let value = '';
      let closed = false;
      while (i < s.length) {
        if (s[i] === '"') {
          closed = true;
          i += 1;
          break;
        }
        value += s[i];
        i += 1;
      }
      if (!closed) throw new SearchSyntaxError('Unbalanced quote in search query');
      tokens.push({ type: 'PHRASE', value });
      continue;
    }
    if (c === '#') {
      i += 1;
      let value = '';
      while (i < s.length && !isBreak(s[i]) && s[i] !== '"') {
        value += s[i];
        i += 1;
      }
      if (!value) throw new SearchSyntaxError('Empty #tag in search query');
      tokens.push({ type: 'TAG', value });
      continue;
    }
    // bare word
    let word = '';
    while (i < s.length && !isBreak(s[i]) && s[i] !== '"') {
      word += s[i];
      i += 1;
    }
    const upper = word.toUpperCase();
    if (upper === 'AND') tokens.push({ type: 'AND' });
    else if (upper === 'OR') tokens.push({ type: 'OR' });
    else if (upper === 'NOT') tokens.push({ type: 'NOT' });
    else tokens.push({ type: 'WORD', value: word });
  }
  return tokens;
}

const TERM_START = new Set(['WORD', 'PHRASE', 'TAG', 'NOT', 'LPAREN']);

export function parse(input) {
  const tokens = tokenize(input);
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().type === 'OR') {
      next();
      const right = parseAnd();
      if (!right) throw new SearchSyntaxError('Dangling OR operator');
      left = { op: 'or', left, right };
    }
    return left;
  }

  function parseAnd() {
    let left = parseNot();
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.type === 'AND') {
        next();
        const right = parseNot();
        if (!right) throw new SearchSyntaxError('Dangling AND operator');
        left = { op: 'and', left, right };
      } else if (TERM_START.has(t.type)) {
        // implicit AND
        const right = parseNot();
        if (!right) break;
        left = { op: 'and', left, right };
      } else {
        break;
      }
    }
    return left;
  }

  function parseNot() {
    if (peek() && peek().type === 'NOT') {
      next();
      const child = parseNot();
      if (!child) throw new SearchSyntaxError('NOT operator with no operand');
      return { op: 'not', child };
    }
    return parseAtom();
  }

  function parseAtom() {
    const t = peek();
    if (!t) return null;
    if (t.type === 'LPAREN') {
      next();
      const inner = parseOr();
      const close = next();
      if (!close || close.type !== 'RPAREN') {
        throw new SearchSyntaxError('Unbalanced parenthesis in search query');
      }
      if (!inner) throw new SearchSyntaxError('Empty parentheses in search query');
      return inner;
    }
    if (t.type === 'WORD') {
      next();
      return { term: 'word', value: t.value };
    }
    if (t.type === 'PHRASE') {
      next();
      return { term: 'phrase', value: t.value };
    }
    if (t.type === 'TAG') {
      next();
      return { term: 'tag', value: t.value };
    }
    // AND/OR/RPAREN here means a misplaced operator
    if (t.type === 'AND' || t.type === 'OR') {
      throw new SearchSyntaxError(`Search query starts with "${t.type}" operator`);
    }
    if (t.type === 'RPAREN') {
      throw new SearchSyntaxError('Unbalanced parenthesis in search query');
    }
    return null;
  }

  const ast = parseOr();
  if (pos < tokens.length) {
    const t = tokens[pos];
    if (t.type === 'RPAREN') throw new SearchSyntaxError('Unbalanced parenthesis in search query');
    throw new SearchSyntaxError('Unexpected token in search query');
  }
  return ast; // null when empty → matches all
}
