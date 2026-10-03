'use strict';

// Normalize a URL for duplicate detection: lowercase scheme/host, drop default
// ports, drop trailing slash and fragment. Query string is preserved.
function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  try {
    const u = new URL(s);
    const proto = u.protocol.toLowerCase();
    const host = u.hostname.toLowerCase();
    let port = u.port;
    if ((port === '80' && proto === 'http:') || (port === '443' && proto === 'https:')) port = '';
    let pathname = u.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    return `${proto}//${host}${port ? ':' + port : ''}${pathname}${u.search}`;
  } catch {
    return s.toLowerCase();
  }
}

// ---- Search query parser -------------------------------------------------
// Supports: bare words, "exact phrases", field prefixes (url:, title:,
// description:/desc:, notes:/note:, tag:/tags:), boolean AND / OR / NOT,
// leading '-' as NOT, and parentheses for grouping.

const FIELD_ALIASES = {
  url: 'url', title: 'title',
  description: 'description', desc: 'description',
  notes: 'notes', note: 'notes',
  tag: 'tag', tags: 'tag'
};

function tokenize(input) {
  const tokens = [];
  const s = String(input || '');
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'rparen' }); i++; continue; }

    // Read one term: optional field prefix + value (quoted or bare).
    let field = null;
    let value = '';
    let quoted = false;
    let negate = false;

    // leading '-' negation on an unquoted term
    if (c === '-' && i + 1 < n && s[i + 1] !== ' ') { negate = true; i++; }

    // possible field prefix: letters followed by ':'
    const rest = s.slice(i);
    const m = /^([a-zA-Z]+):/.exec(rest);
    if (m && FIELD_ALIASES[m[1].toLowerCase()]) {
      field = FIELD_ALIASES[m[1].toLowerCase()];
      i += m[0].length;
    }

    if (i < n && s[i] === '"') {
      quoted = true;
      i++;
      while (i < n && s[i] !== '"') { value += s[i]; i++; }
      if (i < n) i++; // closing quote
    } else {
      while (i < n && !' \t\n\r()'.includes(s[i])) { value += s[i]; i++; }
    }

    if (!quoted && field === null) {
      const up = value.toUpperCase();
      if (up === 'AND' || up === 'OR' || up === 'NOT') { tokens.push({ type: 'op', op: up }); continue; }
    }
    if (value === '' && field === null) continue;
    if (negate) tokens.push({ type: 'op', op: 'NOT' });
    tokens.push({ type: 'term', field, value });
  }
  return tokens;
}

// Recursive-descent parser. Precedence: NOT > AND (implicit) > OR.
function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().type === 'op' && peek().op === 'OR') {
      pos++;
      const right = parseAnd();
      if (right) left = { type: 'or', left, right };
    }
    return left;
  }

  function parseAnd() {
    let left = parseUnary();
    while (peek()) {
      const t = peek();
      if (t.type === 'op' && t.op === 'OR') break;
      if (t.type === 'rparen') break;
      if (t.type === 'op' && t.op === 'AND') { pos++; }
      const right = parseUnary();
      if (!right) break;
      left = left ? { type: 'and', left, right } : right;
    }
    return left;
  }

  function parseUnary() {
    const t = peek();
    if (!t) return null;
    if (t.type === 'op' && t.op === 'NOT') { pos++; const o = parseUnary(); return o ? { type: 'not', operand: o } : null; }
    if (t.type === 'lparen') {
      pos++;
      const e = parseOr();
      if (peek() && peek().type === 'rparen') pos++;
      return e;
    }
    if (t.type === 'term') { pos++; return { type: 'term', field: t.field, value: t.value }; }
    if (t.type === 'op') { pos++; return parseUnary(); } // stray AND/OR
    pos++;
    return null;
  }

  const tree = parseOr();
  return tree;
}

function likeParam(value) {
  const esc = String(value).replace(/[\\%_]/g, (ch) => '\\' + ch);
  return '%' + esc + '%';
}

const TAG_EXISTS = "EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.bookmark_id = b.id AND t.name LIKE ? ESCAPE '\\')";

function termToSql(node, params) {
  const p = likeParam(node.value);
  if (node.field === 'tag') { params.push(p); return TAG_EXISTS; }
  if (node.field === 'url') { params.push(p); return "b.url LIKE ? ESCAPE '\\'"; }
  if (node.field === 'title') { params.push(p); return "b.title LIKE ? ESCAPE '\\'"; }
  if (node.field === 'description') { params.push(p); return "b.description LIKE ? ESCAPE '\\'"; }
  if (node.field === 'notes') { params.push(p); return "b.notes LIKE ? ESCAPE '\\'"; }
  // default: search across all text fields + tags
  params.push(p, p, p, p, p);
  return `(b.url LIKE ? ESCAPE '\\' OR b.title LIKE ? ESCAPE '\\' OR b.description LIKE ? ESCAPE '\\' OR b.notes LIKE ? ESCAPE '\\' OR ${TAG_EXISTS})`;
}

function nodeToSql(node, params) {
  if (!node) return '1=1';
  switch (node.type) {
    case 'term': return termToSql(node, params);
    case 'not': return 'NOT (' + nodeToSql(node.operand, params) + ')';
    case 'and': return '(' + nodeToSql(node.left, params) + ' AND ' + nodeToSql(node.right, params) + ')';
    case 'or': return '(' + nodeToSql(node.left, params) + ' OR ' + nodeToSql(node.right, params) + ')';
    default: return '1=1';
  }
}

// Build a parameterized SQL WHERE fragment (table alias `b`) from a query.
function buildSearch(query) {
  const tree = parse(tokenize(query));
  const params = [];
  const sql = nodeToSql(tree, params);
  return { sql, params };
}

module.exports = { normalizeUrl, buildSearch, tokenize, parse };
