// T030/T031 [US5]: search query language — tokenizer, parser (AST), evaluator.
// See contracts/search-query.md. Case-insensitive throughout.

// ---- Tokenizer -------------------------------------------------------------
function tokenize(input) {
  const tokens = [];
  const s = String(input || '');
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (c === '"') {
      // Quoted phrase: operator words inside quotes are literal text (FR-019).
      let j = i + 1;
      let val = '';
      while (j < s.length && s[j] !== '"') val += s[j++];
      i = j < s.length ? j + 1 : j;
      tokens.push({ type: 'phrase', value: val });
      continue;
    }
    if (c === '#') {
      let j = i + 1;
      let val = '';
      while (j < s.length && !/[\s()]/.test(s[j])) val += s[j++];
      i = j;
      tokens.push({ type: 'tag', value: val });
      continue;
    }
    // Bare word (until whitespace or paren or quote).
    let j = i;
    let val = '';
    while (j < s.length && !/[\s()"]/.test(s[j])) val += s[j++];
    i = j;
    const upper = val.toUpperCase();
    if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
      tokens.push({ type: 'op', op: upper });
    } else {
      tokens.push({ type: 'word', value: val });
    }
  }
  return tokens;
}

// ---- Parser (recursive descent; precedence NOT > AND > OR) ------------------
function isPrimaryStart(tok) {
  return (
    tok &&
    (tok.type === 'word' ||
      tok.type === 'phrase' ||
      tok.type === 'tag' ||
      tok.type === 'lparen' ||
      (tok.type === 'op' && tok.op === 'NOT'))
  );
}

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().type === 'op' && peek().op === 'OR') {
      next();
      const right = parseAnd();
      left = right ? { type: 'or', left, right } : left;
    }
    return left;
  }

  function parseAnd() {
    let left = parseNot();
    for (;;) {
      const t = peek();
      if (t && t.type === 'op' && t.op === 'AND') {
        next();
        const right = parseNot();
        if (right) left = { type: 'and', left, right };
      } else if (isPrimaryStart(t)) {
        // implicit AND between adjacent terms
        const right = parseNot();
        if (right) left = { type: 'and', left, right };
      } else {
        break;
      }
    }
    return left;
  }

  function parseNot() {
    const t = peek();
    if (t && t.type === 'op' && t.op === 'NOT') {
      next();
      const node = parseNot();
      return node ? { type: 'not', node } : null;
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();
    if (!t) return null;
    if (t.type === 'lparen') {
      next();
      const node = parseOr();
      if (peek() && peek().type === 'rparen') next();
      return node;
    }
    if (t.type === 'word') {
      next();
      return { type: 'word', value: t.value };
    }
    if (t.type === 'phrase') {
      next();
      return { type: 'phrase', value: t.value };
    }
    if (t.type === 'tag') {
      next();
      return { type: 'tag', value: t.value };
    }
    // Stray operator/rparen — skip it.
    next();
    return parsePrimary();
  }

  const ast = parseOr();
  return ast;
}

/** Parse a query string into an AST (or null for an empty query). */
export function parseQuery(input) {
  const tokens = tokenize(input);
  if (!tokens.length) return null;
  return parse(tokens);
}

// ---- Evaluator -------------------------------------------------------------
function haystack(bookmark) {
  return [bookmark.title, bookmark.description, bookmark.note, bookmark.url]
    .join('\n')
    .toLowerCase();
}

/** Does a bookmark match the AST? A null AST matches everything. */
export function matches(bookmark, ast) {
  if (!ast) return true;
  switch (ast.type) {
    case 'word':
    case 'phrase':
      return haystack(bookmark).includes(String(ast.value).toLowerCase());
    case 'tag': {
      const want = String(ast.value).toLowerCase();
      return (bookmark.tags || []).some((t) => t.toLowerCase() === want);
    }
    case 'and':
      return matches(bookmark, ast.left) && matches(bookmark, ast.right);
    case 'or':
      return matches(bookmark, ast.left) || matches(bookmark, ast.right);
    case 'not':
      return !matches(bookmark, ast.node);
    default:
      return true;
  }
}

/** Convenience: filter a list of hydrated bookmarks by a query string. */
export function search(bookmarks, query) {
  const ast = parseQuery(query);
  if (!ast) return bookmarks;
  return bookmarks.filter((b) => matches(b, ast));
}
