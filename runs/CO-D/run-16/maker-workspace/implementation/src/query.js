// Search query language.
// Basis: SCN-006 (search everything, case-insensitive, substring),
//        SCN-007 (#tag exact, implicit AND, AND/OR/NOT, parentheses, "phrases",
//                 quoted operators as text; precedence NOT > AND > OR).
//
// buildSearch(raw) -> { active, terms, pred(bookmark) }
//   active : whether a non-empty query is in effect
//   terms  : positive text/tag/phrase strings (for match highlighting)
//   pred   : predicate(bookmark) -> boolean

function tokenize(input) {
  const toks = [];
  let i = 0;
  const n = input.length;
  const isSpace = (c) => c === ' ' || c === '\t' || c === '\n';
  while (i < n) {
    const c = input[i];
    if (isSpace(c)) { i++; continue; }
    if (c === '(') { toks.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { toks.push({ t: 'rp' }); i++; continue; }
    if (c === '"') { // phrase: literal text, even if it spells an operator
      i++;
      let s = '';
      while (i < n && input[i] !== '"') s += input[i++];
      i++; // closing quote
      toks.push({ t: 'term', kind: 'text', v: s.toLowerCase() });
      continue;
    }
    if (c === '#') { // tag term; allows #"multi word"
      i++;
      let tg = '';
      if (input[i] === '"') {
        i++;
        while (i < n && input[i] !== '"') tg += input[i++];
        i++;
      } else {
        while (i < n && !isSpace(input[i]) && input[i] !== '(' && input[i] !== ')') tg += input[i++];
      }
      toks.push({ t: 'term', kind: 'tag', v: tg.toLowerCase() });
      continue;
    }
    let w = '';
    while (i < n && !isSpace(input[i]) && input[i] !== '(' && input[i] !== ')') w += input[i++];
    const up = w.toUpperCase();
    if (up === 'AND' || up === 'OR' || up === 'NOT') toks.push({ t: 'op', v: up });
    else toks.push({ t: 'term', kind: 'text', v: w.toLowerCase() });
  }
  return toks;
}

function fieldHay(b) {
  return [b.title, b.description, b.note, b.url].filter(Boolean).join(' ').toLowerCase();
}
function tagList(b) {
  return (b.tags || []).map((t) => String(t).toLowerCase());
}
function leafPred(tok) {
  if (tok.kind === 'tag') {
    // exact tag match. Basis: SCN-007.
    return (b) => tagList(b).some((t) => t === tok.v);
  }
  // plain text: substring across all fields including tags. Basis: SCN-006.
  return (b) => fieldHay(b).indexOf(tok.v) >= 0 || tagList(b).some((t) => t.indexOf(tok.v) >= 0);
}

// Recursive descent: OR (lowest) -> AND (incl. implicit) -> NOT -> primary.
function parse(toks) {
  let pos = 0;
  const terms = [];
  const peek = () => toks[pos];
  const eat = () => toks[pos++];

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().t === 'op' && peek().v === 'OR') {
      eat();
      const right = parseAnd();
      const l = left, r = right;
      left = (b) => l(b) || r(b);
    }
    return left;
  }
  function parseAnd() {
    let left = parseNot();
    while (peek() && !(peek().t === 'op' && peek().v === 'OR') && peek().t !== 'rp') {
      if (peek().t === 'op' && peek().v === 'AND') eat(); // explicit AND
      const right = parseNot();
      const l = left, r = right;
      left = (b) => l(b) && r(b);
    }
    return left;
  }
  function parseNot() {
    if (peek() && peek().t === 'op' && peek().v === 'NOT') {
      eat();
      const p = parseNot();
      return (b) => !p(b);
    }
    return parsePrimary();
  }
  function parsePrimary() {
    const tk = peek();
    if (!tk) return () => true;
    if (tk.t === 'lp') {
      eat();
      const e = parseOr();
      if (peek() && peek().t === 'rp') eat();
      return e;
    }
    if (tk.t === 'term') { eat(); terms.push(tk.v); return leafPred(tk); }
    eat(); // stray operator / rp
    return () => true;
  }

  const pred = parseOr();
  return { pred, terms };
}

export function buildSearch(raw) {
  const q = (raw || '').trim();
  if (!q) return { active: false, terms: [], pred: () => true };
  try {
    const { pred, terms } = parse(tokenize(q));
    return { active: true, terms, pred };
  } catch {
    const lc = q.toLowerCase();
    return { active: true, terms: [lc], pred: (b) => fieldHay(b).indexOf(lc) >= 0 };
  }
}
