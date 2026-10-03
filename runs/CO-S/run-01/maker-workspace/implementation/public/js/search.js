// Search query engine (SCN-003, SCN-004).
//
// Grammar (case-insensitive; adjacent terms are implicitly ANDed):
//   expr   := or
//   or     := and (OR and)*
//   and    := unary ( (AND)? unary )*
//   unary  := NOT unary | atom
//   atom   := '(' expr ')' | "phrase" | #tag | word
//
// - word        substring match across title, description, note, url, tags
// - "phrase"    exact substring of the quoted text across the same fields
// - #tag        whole-tag exact match
// - AND/OR/NOT  operators in any capitalisation; quote a word to search it literally
// Parsing is lenient: incomplete input (dangling operator, unclosed paren)
// narrows as far as it sensibly can instead of erroring.

function haystack(b) {
  return [b.title, b.desc, b.note, b.url, (b.tags || []).join(' ')].join(' ').toLowerCase();
}

function tokenize(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(') { toks.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { toks.push({ t: 'rp' }); i++; continue; }
    if (c === '"') {
      let j = i + 1, buf = '';
      while (j < s.length && s[j] !== '"') { buf += s[j]; j++; }
      toks.push({ t: 'phrase', v: buf });
      i = j < s.length ? j + 1 : j;
      continue;
    }
    if (c === '#') {
      let j = i + 1, buf = '';
      while (j < s.length && !/[\s()"]/.test(s[j])) { buf += s[j]; j++; }
      toks.push({ t: 'tag', v: buf });
      i = j;
      continue;
    }
    let j = i, buf = '';
    while (j < s.length && !/[\s()"]/.test(s[j])) { buf += s[j]; j++; }
    const up = buf.toUpperCase();
    toks.push((up === 'AND' || up === 'OR' || up === 'NOT') ? { t: 'op', v: up } : { t: 'word', v: buf });
    i = j;
  }
  return toks;
}

const TRUE = () => true;

export function buildQuery(input) {
  const toks = tokenize(input || '');
  let pos = 0;
  const peek = () => toks[pos];
  const canStartUnary = (tk) => tk && (tk.t === 'lp' || tk.t === 'word'
    || tk.t === 'phrase' || tk.t === 'tag' || (tk.t === 'op' && tk.v === 'NOT'));

  function parseExpr() { return parseOr(); }

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().t === 'op' && peek().v === 'OR') {
      pos++;
      if (!canStartUnary(peek())) break; // dangling OR -> drop it (lenient)
      const right = parseAnd();
      const l = left;
      left = (b) => l(b) || right(b);
    }
    return left;
  }

  function parseAnd() {
    let left = parseUnary();
    while (peek()) {
      if (peek().t === 'op' && peek().v === 'AND') {
        pos++;
        if (!canStartUnary(peek())) break;
        const r = parseUnary();
        const l = left;
        left = (b) => l(b) && r(b);
        continue;
      }
      if (canStartUnary(peek())) {
        const r = parseUnary();
        const l = left;
        left = (b) => l(b) && r(b);
        continue;
      }
      break;
    }
    return left;
  }

  function parseUnary() {
    if (peek() && peek().t === 'op' && peek().v === 'NOT') {
      pos++;
      const u = parseUnary();
      return (b) => !u(b);
    }
    return parseAtom();
  }

  function parseAtom() {
    const tk = peek();
    if (!tk) return TRUE;
    if (tk.t === 'lp') {
      pos++;
      const e = parseExpr();
      if (peek() && peek().t === 'rp') pos++;
      return e;
    }
    if (tk.t === 'rp') { pos++; return TRUE; }
    if (tk.t === 'op') { pos++; return parseAtom(); } // stray leading operator
    if (tk.t === 'word') { pos++; const w = tk.v.toLowerCase(); return w ? (b) => haystack(b).includes(w) : TRUE; }
    if (tk.t === 'phrase') { pos++; const w = tk.v.toLowerCase().trim(); return w ? (b) => haystack(b).includes(w) : TRUE; }
    if (tk.t === 'tag') { pos++; const w = tk.v.toLowerCase(); return w ? (b) => (b.tags || []).some(x => x.toLowerCase() === w) : TRUE; }
    pos++;
    return TRUE;
  }

  return parseExpr();
}
