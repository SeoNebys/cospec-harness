'use strict';
// Search query language (SCN-003).
// Supports: bare words (substring across all fields), "exact phrases",
// #tag (matches a tag by exact name), boolean AND / OR / NOT and parentheses.
// Operator words act as operators only when UNQUOTED; a quoted "OR" is a
// literal word. Adjacent terms are combined with implicit AND.
// Precedence: NOT (tightest) > AND > OR. Case-insensitive throughout.

function tokenize(input) {
  const tokens = [];
  const s = String(input || '');
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(') { tokens.push({ t: 'lparen' }); i++; continue; }
    if (c === ')') { tokens.push({ t: 'rparen' }); i++; continue; }
    if (c === '"') {
      let j = i + 1, val = '';
      while (j < s.length && s[j] !== '"') { val += s[j]; j++; }
      i = j < s.length ? j + 1 : j;
      tokens.push({ t: 'term', kind: 'phrase', v: val });
      continue;
    }
    if (c === '#') {
      let j = i + 1, val = '';
      while (j < s.length && !/[\s()]/.test(s[j])) { val += s[j]; j++; }
      i = j;
      tokens.push({ t: 'term', kind: 'tag', v: val });
      continue;
    }
    // bare word until whitespace, paren, or quote
    let j = i, val = '';
    while (j < s.length && !/[\s()"]/.test(s[j])) { val += s[j]; j++; }
    i = j;
    const up = val.toUpperCase();
    if (up === 'AND' || up === 'OR' || up === 'NOT') tokens.push({ t: 'op', v: up });
    else tokens.push({ t: 'term', kind: 'word', v: val });
  }
  return tokens;
}

function parse(input) {
  const tokens = tokenize(input);
  let p = 0;
  const peek = () => tokens[p];

  function parseOr() {
    let node = parseAnd();
    while (peek() && peek().t === 'op' && peek().v === 'OR') {
      p++;
      const right = parseAnd();
      node = { op: 'or', l: node, r: right };
    }
    return node;
  }
  function parseAnd() {
    let node = parseNot();
    while (peek() && !(peek().t === 'op' && peek().v === 'OR') && peek().t !== 'rparen') {
      if (peek().t === 'op' && peek().v === 'AND') p++; // explicit AND
      const right = parseNot();
      if (right == null) break;
      node = { op: 'and', l: node, r: right };
    }
    return node;
  }
  function parseNot() {
    if (peek() && peek().t === 'op' && peek().v === 'NOT') {
      p++;
      const child = parseNot();
      return { op: 'not', c: child == null ? { op: 'true' } : child };
    }
    return parseAtom();
  }
  function parseAtom() {
    const tk = peek();
    if (!tk) return null;
    if (tk.t === 'lparen') {
      p++;
      const n = parseOr();
      if (peek() && peek().t === 'rparen') p++;
      return n == null ? { op: 'true' } : n;
    }
    if (tk.t === 'rparen') return null;
    if (tk.t === 'term') { p++; return { op: 'term', kind: tk.kind, v: tk.v }; }
    if (tk.t === 'op') { p++; return { op: 'term', kind: 'word', v: tk.v }; } // stray operator → literal
    p++;
    return { op: 'true' };
  }

  const tree = parseOr();
  return tree == null ? { op: 'true' } : tree;
}

function fieldsText(b) {
  return [b.title, b.url, b.description, b.note, b.site, (b.tags || []).join(' ')]
    .filter(Boolean).join('\n').toLowerCase();
}

function evaluate(node, b) {
  switch (node.op) {
    case 'true': return true;
    case 'and': return evaluate(node.l, b) && evaluate(node.r, b);
    case 'or': return evaluate(node.l, b) || evaluate(node.r, b);
    case 'not': return !evaluate(node.c, b);
    case 'term':
      if (node.kind === 'tag') {
        const t = node.v.toLowerCase();
        return (b.tags || []).some(x => String(x).toLowerCase() === t);
      }
      if (node.v === '') return true;
      return fieldsText(b).includes(node.v.toLowerCase());
    default: return true;
  }
}

// Collect positive (non-negated) terms for match highlighting/explanation.
function positiveTerms(node, acc = []) {
  if (!node) return acc;
  if (node.op === 'term') { acc.push({ kind: node.kind, v: node.v }); return acc; }
  if (node.op === 'and' || node.op === 'or') { positiveTerms(node.l, acc); positiveTerms(node.r, acc); }
  return acc; // skip subtrees under NOT
}

function makePredicate(input) {
  const tree = parse(input);
  return (b) => evaluate(tree, b);
}

module.exports = { tokenize, parse, evaluate, positiveTerms, makePredicate, fieldsText };
