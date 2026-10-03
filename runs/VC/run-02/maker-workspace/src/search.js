'use strict';

// Parses a boolean search query into a SQL WHERE fragment + params.
//
// Supported syntax:
//   plain word          -> substring match on title/description/notes/url/tags
//   "exact phrase"      -> substring match on the whole quoted phrase
//   tag:name            -> exact (case-insensitive) tag match
//   tag:"two words"     -> exact tag match for a multi-word tag
//   is:read_later       -> bookmark flagged read-later
//   is:archived         -> bookmark archived
//   AND / OR / NOT      -> boolean operators (case-insensitive)
//   ( ... )             -> grouping
//   adjacent terms      -> implicit AND
//
// Precedence: NOT > AND > OR.

function tokenize(input) {
  const tokens = [];
  let i = 0;
  const n = input.length;
  while (i < n) {
    const c = input[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (c === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
    if (c === '"') {
      let j = i + 1, s = '';
      while (j < n && input[j] !== '"') { s += input[j]; j++; }
      i = j < n ? j + 1 : j;
      tokens.push({ type: 'term', kind: 'phrase', value: s });
      continue;
    }
    // field-prefixed terms: tag:… / is:… (value may be quoted)
    const fieldMatch = /^(tag|is):/i.exec(input.slice(i));
    if (fieldMatch) {
      const field = fieldMatch[1].toLowerCase();
      i += fieldMatch[0].length;
      let val = '';
      if (input[i] === '"') {
        i++;
        while (i < n && input[i] !== '"') { val += input[i]; i++; }
        if (i < n) i++; // skip closing quote
      } else {
        while (i < n && !' \t\n()'.includes(input[i])) { val += input[i]; i++; }
      }
      tokens.push({ type: 'term', kind: field, value: val });
      continue;
    }
    // read a bare chunk up to whitespace, paren or quote
    let j = i, s = '';
    while (j < n && !' \t\n()"'.includes(input[j])) { s += input[j]; j++; }
    i = j;
    const upper = s.toUpperCase();
    if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
      tokens.push({ type: 'op', value: upper });
      continue;
    }
    tokens.push({ type: 'term', kind: 'word', value: s });
  }
  return tokens;
}

function termCondition(tok, params) {
  if (tok.kind === 'tag') {
    params.push(tok.value);
    return `EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
            WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`;
  }
  if (tok.kind === 'is') {
    const v = tok.value.toLowerCase();
    if (v === 'read_later' || v === 'readlater' || v === 'later') return 'b.read_later = 1';
    if (v === 'archived' || v === 'archive') return 'b.archived = 1';
    if (v === 'snapshot' || v === 'snapshotted') {
      return 'EXISTS (SELECT 1 FROM snapshots s WHERE s.bookmark_id = b.id)';
    }
    return '1=0';
  }
  // word or phrase: substring across text fields + tag names
  const like = `%${tok.value}%`;
  for (let k = 0; k < 5; k++) params.push(like);
  return `(
    COALESCE(b.title,'')       LIKE ? OR
    COALESCE(b.description,'') LIKE ? OR
    COALESCE(b.notes,'')       LIKE ? OR
    COALESCE(b.url,'')         LIKE ? OR
    EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id
            WHERE bt.bookmark_id = b.id AND t.name LIKE ?)
  )`;
}

// Recursive-descent parser producing { sql, params }.
function parse(tokens) {
  let pos = 0;
  const params = [];

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr() { return parseOr(); }

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().type === 'op' && peek().value === 'OR') {
      next();
      const right = parseAnd();
      left = `(${left} OR ${right})`;
    }
    return left;
  }

  function parseAnd() {
    let left = parseNot();
    while (peek()) {
      const t = peek();
      if (t.type === 'op' && t.value === 'AND') { next(); }
      else if (t.type === 'op' && t.value === 'OR') { break; }
      else if (t.type === 'rparen') { break; }
      else { /* implicit AND */ }
      const right = parseNot();
      if (right == null) break;
      left = `(${left} AND ${right})`;
    }
    return left;
  }

  function parseNot() {
    if (peek() && peek().type === 'op' && peek().value === 'NOT') {
      next();
      const operand = parseNot();
      return `(NOT ${operand})`;
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();
    if (!t) return '1=1';
    if (t.type === 'lparen') {
      next();
      const inner = parseExpr();
      if (peek() && peek().type === 'rparen') next();
      return `(${inner})`;
    }
    if (t.type === 'term') {
      next();
      if (t.value === '') return '1=1';
      return termCondition(t, params);
    }
    // stray operator or rparen — skip it
    next();
    return '1=1';
  }

  const sql = parseExpr();
  return { sql: sql || '1=1', params };
}

function buildSearchClause(query) {
  const q = (query || '').trim();
  if (!q) return { sql: '1=1', params: [] };
  try {
    const tokens = tokenize(q);
    if (tokens.length === 0) return { sql: '1=1', params: [] };
    return parse(tokens);
  } catch (e) {
    // Fallback: treat entire input as a single substring term.
    const params = [];
    const sql = termCondition({ kind: 'word', value: q }, params);
    return { sql, params };
  }
}

module.exports = { buildSearchClause, tokenize };
