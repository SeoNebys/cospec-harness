/* Search query language (SCN-005).
 * Plain words = substring across title, description, note, tags, site, full URL;
 * multiple words = AND. "quoted phrase" literal. #tag / #"multi word" = exact tag.
 * AND / OR / NOT with ( ) grouping. A quoted operator word is literal text.
 * Malformed queries fall back to matching on the individual words.
 * Works in the browser and under Node (for unit tests). */
(function (root) {
  'use strict';

  function haystackOf(b) {
    return [b.title, b.description, b.note, (b.tags || []).join(' '), b.host, b.url]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function tokenize(s) {
    const toks = []; let i = 0;
    const isWord = c => c && /[^\s()"]/.test(c);
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '(') { toks.push({ type: 'lparen' }); i++; continue; }
      if (c === ')') { toks.push({ type: 'rparen' }); i++; continue; }
      if (c === '"') {
        i++; let buf = '';
        while (i < s.length && s[i] !== '"') { buf += s[i]; i++; }
        if (i < s.length) i++;
        toks.push({ type: 'text', value: buf.toLowerCase() });
        continue;
      }
      if (c === '#') {
        i++; let buf = '';
        if (s[i] === '"') { i++; while (i < s.length && s[i] !== '"') { buf += s[i]; i++; } if (i < s.length) i++; }
        else { while (isWord(s[i])) { buf += s[i]; i++; } }
        toks.push({ type: 'tag', value: buf.toLowerCase() });
        continue;
      }
      let buf = '';
      while (isWord(s[i])) { buf += s[i]; i++; }
      const up = buf.toUpperCase();
      if (up === 'AND') toks.push({ type: 'and' });
      else if (up === 'OR') toks.push({ type: 'or' });
      else if (up === 'NOT') toks.push({ type: 'not' });
      else toks.push({ type: 'text', value: buf.toLowerCase() });
    }
    return toks;
  }

  function parse(str) {
    const toks = tokenize(str);
    if (toks.length === 0) return null;
    let pos = 0;
    const peek = () => toks[pos];
    const next = () => toks[pos++];
    const operand = t => t && (t.type === 'text' || t.type === 'tag' || t.type === 'lparen' || t.type === 'not');
    function pOr() { let n = pAnd(); while (peek() && peek().type === 'or') { next(); n = { op: 'or', l: n, r: pAnd() }; } return n; }
    function pAnd() {
      let n = pNot();
      while (peek()) {
        const t = peek();
        if (t.type === 'and') { next(); n = { op: 'and', l: n, r: pNot() }; }
        else if (operand(t)) { n = { op: 'and', l: n, r: pNot() }; }
        else break;
      }
      return n;
    }
    function pNot() { if (peek() && peek().type === 'not') { next(); return { op: 'not', c: pNot() }; } return pPrimary(); }
    function pPrimary() {
      const t = next();
      if (!t) throw new Error('unexpected end');
      if (t.type === 'lparen') { const n = pOr(); const cl = next(); if (!cl || cl.type !== 'rparen') throw new Error('expected )'); return n; }
      if (t.type === 'text') return { op: 'text', value: t.value };
      if (t.type === 'tag') return { op: 'tag', value: t.value };
      throw new Error('unexpected ' + t.type);
    }
    const ast = pOr();
    if (pos !== toks.length) throw new Error('trailing input');
    return ast;
  }

  function fallback(q) {
    const words = q.toLowerCase().replace(/["#()]/g, ' ').split(/\s+/)
      .filter(Boolean).filter(w => w !== 'and' && w !== 'or' && w !== 'not');
    if (!words.length) return null;
    return words.map(w => ({ op: 'text', value: w })).reduce((a, b) => ({ op: 'and', l: a, r: b }));
  }

  function evalNode(node, b, hay) {
    switch (node.op) {
      case 'text': return node.value === '' ? true : hay.indexOf(node.value) !== -1;
      case 'tag': return (b.tags || []).some(t => t === node.value);
      case 'and': return evalNode(node.l, b, hay) && evalNode(node.r, b, hay);
      case 'or': return evalNode(node.l, b, hay) || evalNode(node.r, b, hay);
      case 'not': return !evalNode(node.c, b, hay);
    }
    return true;
  }

  // Returns { test(bookmark)->bool, error:bool }. Empty query matches everything.
  function makeFilter(query) {
    const q = (query || '').trim();
    if (!q) return { test: () => true, error: false };
    let ast, error = false;
    try { ast = parse(q); } catch (e) { ast = fallback(q); error = true; }
    if (!ast) return { test: () => true, error: false };
    return { test: b => evalNode(ast, b, haystackOf(b)), error };
  }

  const api = { haystackOf, parse, makeFilter, tokenize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Query = api;
})(typeof window !== 'undefined' ? window : this);
