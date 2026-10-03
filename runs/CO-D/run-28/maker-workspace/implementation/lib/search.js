/*
 * Search query grammar and matcher.
 * Basis: SCN-003 (case-insensitive across url/title/description/note),
 *        SCN-005 (#tag, "phrase", AND/OR/NOT, parentheses, implicit AND,
 *                 operators literal inside quotes, incomplete query flagged).
 * UMD: Node (require) and browser (window.Search).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.Search = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  function haystack(b) {
    return [b.url, b.title, b.description, b.note].map(x => x || '').join('\n').toLowerCase();
  }

  function tokenize(s) {
    const toks = [];
    const re = /\s*(\(|\)|"[^"]*"|#[^\s()]+|[^\s()]+)/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      const t = m[1];
      const up = t.toUpperCase();
      if (t === '(' || t === ')') toks.push({ k: t });
      else if (up === 'AND' || up === 'OR' || up === 'NOT') toks.push({ k: up });
      else if (t[0] === '#') toks.push({ k: 'term', tag: t.slice(1).toLowerCase() });
      else if (t[0] === '"') toks.push({ k: 'term', text: t.slice(1, -1).toLowerCase() });
      else toks.push({ k: 'term', text: t.toLowerCase() });
    }
    return toks;
  }

  // Precedence: NOT > AND > OR; implicit AND between adjacent operands.
  function parseQuery(s) {
    const toks = tokenize(s || '');
    let i = 0;
    const peek = () => toks[i];
    const next = () => toks[i++];

    function primary() {
      const t = peek();
      if (!t) throw new Error('unexpected end');
      if (t.k === '(') { next(); const e = orExpr(); if (!peek() || peek().k !== ')') throw new Error('missing )'); next(); return e; }
      if (t.k === 'term') {
        next();
        if (t.tag !== undefined) return b => (b.tags || []).indexOf(t.tag) >= 0;
        return b => haystack(b).indexOf(t.text) >= 0;
      }
      throw new Error('unexpected token');
    }
    function notExpr() { if (peek() && peek().k === 'NOT') { next(); const e = notExpr(); return b => !e(b); } return primary(); }
    function isOperandStart(t) { return t && (t.k === 'term' || t.k === '(' || t.k === 'NOT'); }
    function andExpr() {
      let l = notExpr();
      while (peek() && (peek().k === 'AND' || isOperandStart(peek()))) {
        if (peek().k === 'AND') next();
        const r = notExpr(); const a = l; l = b => a(b) && r(b);
      }
      return l;
    }
    function orExpr() {
      let l = andExpr();
      while (peek() && peek().k === 'OR') { next(); const r = andExpr(); const a = l; l = b => a(b) || r(b); }
      return l;
    }

    if (toks.length === 0) return { ok: true, pred: () => true };
    try {
      const e = orExpr();
      if (i !== toks.length) throw new Error('trailing tokens');
      return { ok: true, pred: e };
    } catch (_) {
      return { ok: false };
    }
  }

  // Plain text terms (not tags/operators) for highlighting.
  function termsFromQuery(s) {
    return tokenize(s || '').filter(t => t.k === 'term' && t.text !== undefined).map(t => t.text).filter(Boolean);
  }

  return { tokenize, parseQuery, termsFromQuery, haystack };
});
