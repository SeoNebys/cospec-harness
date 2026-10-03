// Search query language: tokenizer + recursive-descent parser -> boolean AST,
// then compiled to a parameterized SQL WHERE fragment.
// Grammar & semantics: contracts/search-query-grammar.md
//   - WORD: case-insensitive substring over title/description/notes_text/url
//   - "phrase": literal substring (operator words inside quotes are literal)
//   - #tag: bookmark carries that tag
//   - AND / OR / NOT (unquoted, any case) + parentheses; implicit AND
//   - precedence: NOT > AND > OR

const OPERATORS = new Set(['AND', 'OR', 'NOT']);

export function tokenize(input) {
  const tokens = [];
  const s = String(input ?? '');
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }
    if (c === '"') {
      let j = i + 1;
      let val = '';
      while (j < s.length && s[j] !== '"') { val += s[j]; j++; }
      i = j < s.length ? j + 1 : j; // skip closing quote if present
      tokens.push({ type: 'PHRASE', value: val });
      continue;
    }
    if (c === '#') {
      let j = i + 1;
      let val = '';
      while (j < s.length && !/[\s()"]/.test(s[j])) { val += s[j]; j++; }
      i = j;
      if (val) tokens.push({ type: 'TAG', value: val });
      continue;
    }
    // bare word
    let j = i;
    let val = '';
    while (j < s.length && !/[\s()"]/.test(s[j])) { val += s[j]; j++; }
    i = j;
    const upper = val.toUpperCase();
    if (OPERATORS.has(upper)) tokens.push({ type: upper });
    else tokens.push({ type: 'WORD', value: val });
  }
  return tokens;
}

// Parser. Returns an AST node or null (empty query). Throws on malformed input.
export function parse(input) {
  const tokens = tokenize(input);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr() {
    let node = parseAnd();
    while (peek() && peek().type === 'OR') {
      next();
      const right = parseAnd();
      if (!right) throw new SyntaxError('Expected an expression after OR');
      node = { type: 'or', left: node, right };
    }
    return node;
  }

  function parseAnd() {
    let node = parseNot();
    while (peek() && peek().type !== 'OR' && peek().type !== 'RPAREN') {
      if (peek().type === 'AND') next(); // explicit AND (implicit otherwise)
      const right = parseNot();
      if (!right) throw new SyntaxError('Expected an expression after AND');
      node = { type: 'and', left: node, right };
    }
    return node;
  }

  function parseNot() {
    if (peek() && peek().type === 'NOT') {
      next();
      const child = parseNot();
      if (!child) throw new SyntaxError('Expected an expression after NOT');
      return { type: 'not', child };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();
    if (!t) return null;
    if (t.type === 'LPAREN') {
      next();
      const inner = parseOr();
      if (!peek() || peek().type !== 'RPAREN') throw new SyntaxError('Unbalanced parentheses');
      next();
      return inner;
    }
    if (t.type === 'WORD') { next(); return { type: 'word', value: t.value }; }
    if (t.type === 'PHRASE') { next(); return { type: 'phrase', value: t.value }; }
    if (t.type === 'TAG') { next(); return { type: 'tag', value: t.value }; }
    // A stray operator or RPAREN here is malformed.
    throw new SyntaxError(`Unexpected token: ${t.type}`);
  }

  const ast = parseOr();
  if (pos < tokens.length) throw new SyntaxError('Unexpected trailing tokens');
  return ast;
}

// Compile an AST to { sql, params } evaluated per-bookmark row aliased `b`.
// Text match escapes LIKE wildcards; tag match uses an EXISTS subquery.
function compile(node, params) {
  if (!node) return '1=1';
  switch (node.type) {
    case 'and':
      return `(${compile(node.left, params)} AND ${compile(node.right, params)})`;
    case 'or':
      return `(${compile(node.left, params)} OR ${compile(node.right, params)})`;
    case 'not':
      return `(NOT ${compile(node.child, params)})`;
    case 'word':
    case 'phrase': {
      const like = `%${escapeLike(node.value.toLowerCase())}%`;
      params.push(like, like, like, like);
      return `(lower(b.title) LIKE ? ESCAPE '\\' OR lower(b.description) LIKE ? ESCAPE '\\'`
        + ` OR lower(b.notes_text) LIKE ? ESCAPE '\\' OR lower(b.url) LIKE ? ESCAPE '\\')`;
    }
    case 'tag': {
      params.push(node.value);
      return `EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id`
        + ` WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`;
    }
    default:
      return '1=1';
  }
}

function escapeLike(s) {
  return s.replace(/[\\%_]/g, (m) => '\\' + m);
}

// Public: turn a query string into a SQL WHERE fragment + params.
// On malformed input, throws SyntaxError (callers map to a clear 400 message).
export function buildWhere(query) {
  const ast = parse(query);
  const params = [];
  const sql = compile(ast, params);
  return { sql, params, isEmpty: ast == null };
}
