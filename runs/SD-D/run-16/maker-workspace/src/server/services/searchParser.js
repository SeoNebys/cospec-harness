// Hand-written tokenizer + recursive-descent parser for the search grammar:
//   "exact phrase"   -> literal text term
//   #tag             -> tag membership term
//   AND / OR / NOT   -> boolean operators (only when UNQUOTED)
//   ( ... )          -> grouping
//   adjacent terms   -> implicit AND (including text next to #tag)
// Quoted operator words (e.g. "AND") are treated as literal text terms.
// Precedence: NOT > AND > OR.

const OPERATORS = new Set(['AND', 'OR', 'NOT']);

export function tokenize(input) {
  const tokens = [];
  const s = String(input || '');
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (ch === '"') {
      // quoted phrase -> always a literal term (operators inside are literal)
      let j = i + 1;
      let value = '';
      while (j < s.length && s[j] !== '"') {
        value += s[j];
        j++;
      }
      i = j < s.length ? j + 1 : j; // skip closing quote if present
      if (value.trim()) tokens.push({ type: 'term', value: value.trim(), phrase: true });
      continue;
    }
    if (ch === '#') {
      let j = i + 1;
      let value = '';
      while (j < s.length && !/[\s()"]/.test(s[j])) {
        value += s[j];
        j++;
      }
      i = j;
      if (value) tokens.push({ type: 'tag', value });
      continue;
    }
    // bare word: read until whitespace, paren, or quote
    let j = i;
    let word = '';
    while (j < s.length && !/[\s()"]/.test(s[j])) {
      word += s[j];
      j++;
    }
    i = j;
    if (!word) continue;
    if (OPERATORS.has(word.toUpperCase())) {
      tokens.push({ type: 'op', value: word.toUpperCase() });
    } else {
      tokens.push({ type: 'term', value: word, phrase: false });
    }
  }
  return tokens;
}

function isTermStart(tok) {
  return tok && (tok.type === 'term' || tok.type === 'tag' || tok.type === 'lparen' || (tok.type === 'op' && tok.value === 'NOT'));
}

export function parse(input) {
  const tokens = tokenize(input);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function fail(message) {
    const e = new Error(message);
    e.status = 400;
    e.code = 'search_invalid';
    throw e;
  }

  function parseOr() {
    let node = parseAnd();
    while (peek() && peek().type === 'op' && peek().value === 'OR') {
      next();
      const right = parseAnd();
      if (!right) fail('Expected a term after OR.');
      node = { type: 'or', left: node, right };
    }
    return node;
  }

  function parseAnd() {
    let node = parseNot();
    for (;;) {
      const tok = peek();
      if (!tok) break;
      if (tok.type === 'op' && tok.value === 'AND') {
        next();
        const right = parseNot();
        if (!right) fail('Expected a term after AND.');
        node = node ? { type: 'and', left: node, right } : right;
        continue;
      }
      // implicit AND between adjacent terms
      if (isTermStart(tok)) {
        const right = parseNot();
        node = node ? { type: 'and', left: node, right } : right;
        continue;
      }
      break;
    }
    return node;
  }

  function parseNot() {
    const tok = peek();
    if (tok && tok.type === 'op' && tok.value === 'NOT') {
      next();
      const operand = parseNot();
      if (!operand) fail('Expected a term after NOT.');
      return { type: 'not', operand };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const tok = peek();
    if (!tok) return null;
    if (tok.type === 'lparen') {
      next();
      const node = parseOr();
      const close = next();
      if (!close || close.type !== 'rparen') fail('Missing closing parenthesis.');
      return node;
    }
    if (tok.type === 'rparen') {
      fail('Unexpected closing parenthesis.');
    }
    if (tok.type === 'op') {
      // A stray AND/OR at a primary position is invalid
      fail(`Unexpected operator "${tok.value}".`);
    }
    next();
    if (tok.type === 'term') return { type: 'term', value: tok.value, phrase: tok.phrase };
    if (tok.type === 'tag') return { type: 'tag', value: tok.value };
    return null;
  }

  const ast = parseOr();
  if (pos < tokens.length) {
    fail('Could not parse the whole query.');
  }
  return ast; // null means "match everything"
}
