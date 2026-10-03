// Search query parser + evaluator (contracts/search-grammar.md).
// Grammar:
//   query    = or_expr
//   or_expr  = and_expr { "OR" and_expr }
//   and_expr = unary { ["AND"] unary }        (adjacency => implicit AND)
//   unary    = ["NOT"] primary
//   primary  = word | phrase | tag_term | "(" or_expr ")"
//
// Words/phrases match (case-insensitively) across title, url, description,
// note, AND tag names. #tag matches tag names only.

export class SearchError extends Error {}

// ---- Tokenizer ---------------------------------------------------------
function tokenize(input) {
  const tokens = [];
  let i = 0;
  const s = input;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (c === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }
    if (c === '"') {
      // Quoted phrase: literal text, operators inside are NOT operators.
      let j = i + 1;
      let val = '';
      let closed = false;
      while (j < s.length) {
        if (s[j] === '"') { closed = true; break; }
        val += s[j];
        j++;
      }
      if (!closed) throw new SearchError('Unbalanced quotes in query.');
      tokens.push({ type: 'PHRASE', value: val });
      i = j + 1;
      continue;
    }
    if (c === '#') {
      let j = i + 1;
      let val = '';
      while (j < s.length && !/[\s()"]/.test(s[j])) { val += s[j]; j++; }
      if (!val) throw new SearchError('Empty #tag term in query.');
      tokens.push({ type: 'TAG', value: val });
      i = j;
      continue;
    }
    // Bare run of non-space, non-paren, non-quote characters.
    let j = i;
    let val = '';
    while (j < s.length && !/[\s()"]/.test(s[j])) { val += s[j]; j++; }
    if (val === 'AND' || val === 'OR' || val === 'NOT') {
      tokens.push({ type: val });
    } else {
      tokens.push({ type: 'WORD', value: val });
    }
    i = j;
  }
  return tokens;
}

// ---- Parser (recursive descent) ---------------------------------------
function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().type === 'OR') {
      next();
      const right = parseAnd();
      left = { op: 'OR', left, right };
    }
    return left;
  }

  function parseAnd() {
    let left = parseUnary();
    while (peek() && isOperandStart(peek())) {
      // Explicit AND or adjacency (implicit AND).
      if (peek().type === 'AND') next();
      const right = parseUnary();
      left = { op: 'AND', left, right };
    }
    // A stray explicit AND with no following operand is an error.
    if (peek() && peek().type === 'AND') {
      throw new SearchError('Dangling operator in query.');
    }
    return left;
  }

  function isOperandStart(tok) {
    return tok.type === 'AND' || tok.type === 'NOT' ||
      tok.type === 'WORD' || tok.type === 'PHRASE' ||
      tok.type === 'TAG' || tok.type === 'LPAREN';
  }

  function parseUnary() {
    if (peek() && peek().type === 'NOT') {
      next();
      const operand = parseUnary();
      return { op: 'NOT', operand };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const tok = peek();
    if (!tok) throw new SearchError('Dangling operator in query.');
    if (tok.type === 'OR' || tok.type === 'AND' || tok.type === 'NOT') {
      throw new SearchError('Dangling operator in query.');
    }
    if (tok.type === 'LPAREN') {
      next();
      if (peek() && peek().type === 'RPAREN') {
        throw new SearchError('Empty parentheses in query.');
      }
      const inner = parseOr();
      if (!peek() || peek().type !== 'RPAREN') {
        throw new SearchError('Unbalanced parentheses in query.');
      }
      next();
      return inner;
    }
    if (tok.type === 'RPAREN') {
      throw new SearchError('Unbalanced parentheses in query.');
    }
    next();
    if (tok.type === 'WORD') return { op: 'WORD', value: tok.value };
    if (tok.type === 'PHRASE') return { op: 'PHRASE', value: tok.value };
    if (tok.type === 'TAG') return { op: 'TAG', value: tok.value };
    throw new SearchError('Unexpected token in query.');
  }

  const ast = parseOr();
  if (pos < tokens.length) {
    // Leftover tokens (e.g. an extra ')').
    throw new SearchError('Unbalanced parentheses in query.');
  }
  return ast;
}

export function parseQuery(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return null; // empty query matches everything
  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return null;
  return parse(tokens);
}

// ---- Evaluator ---------------------------------------------------------
// bookmark: { title, url, description, note, tags: [names] }
export function evaluate(ast, bookmark) {
  if (!ast) return true;
  switch (ast.op) {
    case 'AND': return evaluate(ast.left, bookmark) && evaluate(ast.right, bookmark);
    case 'OR': return evaluate(ast.left, bookmark) || evaluate(ast.right, bookmark);
    case 'NOT': return !evaluate(ast.operand, bookmark);
    case 'WORD':
    case 'PHRASE':
      return matchText(ast.value, bookmark);
    case 'TAG':
      return matchTag(ast.value, bookmark);
    default:
      return false;
  }
}

function matchText(value, bm) {
  const needle = value.toLowerCase();
  const fields = [bm.title, bm.url, bm.description, bm.note];
  for (const f of fields) {
    if (f && f.toLowerCase().includes(needle)) return true;
  }
  // Word/phrase terms also match tag names (FR-009).
  for (const t of bm.tags || []) {
    if (t && t.toLowerCase().includes(needle)) return true;
  }
  return false;
}

function matchTag(value, bm) {
  const needle = value.toLowerCase();
  for (const t of bm.tags || []) {
    if (t && t.toLowerCase() === needle) return true;
  }
  return false;
}
