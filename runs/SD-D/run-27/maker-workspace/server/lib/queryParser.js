// Boolean search query parser (spec FR-012/FR-013, research §6).
// Grammar (precedence low->high): OR, AND (also implicit for adjacent terms), NOT (prefix).
// Terms: quoted phrases "..."  |  #tag  |  bare keyword  |  ( expr )
// Operators AND/OR/NOT are only operators when UNQUOTED; quoting makes them literal text.

export class QueryError extends Error {}

// --- Tokenizer ---
function tokenize(input) {
  const tokens = [];
  let i = 0;
  const s = input;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
    if (c === '"') {
      // quoted phrase -> literal term (operators inside are literal)
      let j = i + 1;
      let val = '';
      let closed = false;
      while (j < s.length) {
        if (s[j] === '"') { closed = true; break; }
        val += s[j];
        j++;
      }
      if (!closed) throw new QueryError('Unbalanced quotes in query');
      tokens.push({ type: 'term', kind: 'phrase', value: val });
      i = j + 1;
      continue;
    }
    if (c === '#') {
      // tag term: read until whitespace or paren
      let j = i + 1;
      let val = '';
      while (j < s.length && !/[\s()]/.test(s[j])) { val += s[j]; j++; }
      if (val === '') throw new QueryError('Empty #tag in query');
      tokens.push({ type: 'term', kind: 'tag', value: val });
      i = j;
      continue;
    }
    // bare word: read until whitespace or paren (quotes handled above)
    let j = i;
    let val = '';
    while (j < s.length && !/[\s()]/.test(s[j]) && s[j] !== '"') { val += s[j]; j++; }
    const upper = val.toUpperCase();
    if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
      tokens.push({ type: 'op', op: upper });
    } else {
      tokens.push({ type: 'term', kind: 'keyword', value: val });
    }
    i = j;
  }
  return tokens;
}

// --- Recursive descent parser ---
// orExpr   := andExpr (OR andExpr)*
// andExpr  := notExpr ((AND notExpr) | notExpr)*   (implicit AND for adjacency)
// notExpr  := NOT notExpr | primary
// primary  := term | ( orExpr )
function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().type === 'op' && peek().op === 'OR') {
      next();
      const right = parseAnd();
      left = { type: 'or', left, right };
    }
    return left;
  }

  function parseAnd() {
    let left = parseNot();
    while (peek()) {
      const t = peek();
      if (t.type === 'op' && t.op === 'AND') {
        next();
        const right = parseNot();
        left = { type: 'and', left, right };
      } else if (t.type === 'term' || t.type === 'lparen' || (t.type === 'op' && t.op === 'NOT')) {
        // implicit AND for adjacent terms/groups/NOT
        const right = parseNot();
        left = { type: 'and', left, right };
      } else {
        break;
      }
    }
    return left;
  }

  function parseNot() {
    if (peek() && peek().type === 'op' && peek().op === 'NOT') {
      next();
      return { type: 'not', operand: parseNot() };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();
    if (!t) throw new QueryError('Unexpected end of query');
    if (t.type === 'lparen') {
      next();
      const expr = parseOr();
      const closing = next();
      if (!closing || closing.type !== 'rparen') throw new QueryError('Unbalanced parentheses in query');
      return expr;
    }
    if (t.type === 'rparen') throw new QueryError('Unexpected ) in query');
    if (t.type === 'op') throw new QueryError(`Unexpected operator ${t.op} in query`);
    // term
    next();
    return { type: 'term', kind: t.kind, value: t.value };
  }

  const ast = parseOr();
  if (pos !== tokens.length) throw new QueryError('Malformed query');
  return ast;
}

export function parseQuery(input) {
  if (!input || !input.trim()) return null;
  const tokens = tokenize(input);
  if (tokens.length === 0) return null;
  return parse(tokens);
}

// Compile AST to a SQL boolean predicate over a bookmark row.
// Returns { sql, params } where sql is a WHERE-fragment referencing `b` (bookmarks alias).
// Text leaves match via the FTS table; tag leaves via bookmark_tags/tags.
export function compileToSql(ast) {
  const params = [];
  function esc(str) {
    // Escape for FTS5 phrase matching: wrap in double quotes, escape internal quotes.
    return '"' + String(str).replace(/"/g, '""') + '"';
  }
  function walk(node) {
    switch (node.type) {
      case 'and':
        return `(${walk(node.left)} AND ${walk(node.right)})`;
      case 'or':
        return `(${walk(node.left)} OR ${walk(node.right)})`;
      case 'not':
        return `(NOT ${walk(node.operand)})`;
      case 'term': {
        if (node.kind === 'tag') {
          params.push(node.value.toLowerCase());
          return `(b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE lower(t.name) = ?))`;
        }
        // keyword or phrase -> FTS match on any text column
        params.push(esc(node.value));
        return `(b.id IN (SELECT rowid FROM bookmark_fts WHERE bookmark_fts MATCH ?))`;
      }
      default:
        throw new QueryError('Invalid query node');
    }
  }
  const sql = walk(ast);
  return { sql, params };
}
