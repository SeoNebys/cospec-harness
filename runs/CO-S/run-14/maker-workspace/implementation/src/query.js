/*
 * Search query language for bookmarks (SCN-007).
 * Grammar (case-insensitive keywords):
 *   expr   := term (OR term)*
 *   term   := factor ((AND)? factor)*        // adjacency = implicit AND
 *   factor := NOT factor | '(' expr ')' | atom
 *   atom   := '"' phrase '"' | '#' tag | word
 *
 * - bare word / phrase: substring match (case-insensitive) across
 *   title, description, note, site, url and tags.
 * - #tag: matches a bookmark that has that exact tag (case-insensitive).
 * - Malformed queries fall back to a plain-text substring match of the raw
 *   input (ok:false) rather than throwing.
 *
 * Shared module: usable in Node (require) and the browser (window.BQuery).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BQuery = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function fieldsOf(bm) {
    return [bm.title, bm.description, bm.note, bm.site, bm.url];
  }
  function textIncludes(bm, needle) {
    const n = needle.toLowerCase();
    if (!n) return true;
    if (fieldsOf(bm).some(f => (f || '').toLowerCase().includes(n))) return true;
    return (bm.tags || []).some(t => t.toLowerCase().includes(n));
  }
  function hasTag(bm, tag) {
    const t = tag.toLowerCase();
    return (bm.tags || []).some(x => x.toLowerCase() === t);
  }

  function tokenize(q) {
    const toks = [];
    let i = 0;
    while (i < q.length) {
      const c = q[i];
      if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
      if (c === '(' || c === ')') { toks.push({ t: c }); i++; continue; }
      if (c === '"') {
        let j = i + 1, s = '';
        while (j < q.length && q[j] !== '"') { s += q[j]; j++; }
        if (j >= q.length) throw new Error('unclosed quote');
        toks.push({ t: 'val', phrase: true, v: s });
        i = j + 1; continue;
      }
      let j = i, s = '';
      while (j < q.length && ' \t\n()'.indexOf(q[j]) === -1) { s += q[j]; j++; }
      i = j;
      const up = s.toUpperCase();
      if (up === 'AND' || up === 'OR' || up === 'NOT') toks.push({ t: up });
      else if (s[0] === '#' && s.length > 1) toks.push({ t: 'val', tag: s.slice(1) });
      else toks.push({ t: 'val', v: s });
    }
    return toks;
  }

  function parse(toks, terms) {
    let p = 0;
    const peek = () => toks[p];
    const next = () => toks[p++];

    function expr() {
      let node = term();
      while (peek() && peek().t === 'OR') { next(); const r = term(); const a = node, b = r; node = bm => a(bm) || b(bm); }
      return node;
    }
    function term() {
      let node = factor();
      while (peek() && (peek().t === 'AND' || peek().t === 'val' || peek().t === '(' || peek().t === 'NOT')) {
        if (peek().t === 'AND') next();
        const r = factor(); const a = node, b = r; node = bm => a(bm) && b(bm);
      }
      return node;
    }
    function factor() {
      const tk = peek();
      if (!tk) throw new Error('unexpected end of query');
      if (tk.t === 'NOT') { next(); const f = factor(); return bm => !f(bm); }
      if (tk.t === '(') { next(); const e = expr(); if (!peek() || peek().t !== ')') throw new Error('missing )'); next(); return e; }
      if (tk.t === 'val') { next(); return atom(tk); }
      throw new Error('unexpected token');
    }
    function atom(tk) {
      if (tk.tag !== undefined) return bm => hasTag(bm, tk.tag);
      const v = tk.v || '';
      if (v) terms.push(v);
      return bm => textIncludes(bm, v);
    }

    const node = expr();
    if (peek()) throw new Error('unexpected token: ' + (peek().v || peek().t));
    return node;
  }

  // Returns { ok, error, terms, test(bookmark) }
  function buildMatcher(q) {
    const raw = (q || '').trim();
    const terms = [];
    if (!raw) return { ok: true, error: null, terms, test: () => true };
    try {
      const toks = tokenize(raw);
      if (!toks.length) return { ok: true, error: null, terms, test: () => true };
      const test = parse(toks, terms);
      return { ok: true, error: null, terms, test };
    } catch (e) {
      // graceful fallback: treat the whole thing as plain text
      return { ok: false, error: e.message, terms: [raw], test: bm => textIncludes(bm, raw) };
    }
  }

  return { buildMatcher, textIncludes, hasTag };
});
