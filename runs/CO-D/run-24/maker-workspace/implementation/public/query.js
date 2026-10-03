'use strict';
// Search query language (SCN-004). Shared by the browser UI and Node tests.
// Grammar: OR > AND (implicit between adjacent terms) precedence, NOT unary,
// parentheses group. Terms: bareword (substring, case-insensitive across
// title/description/note/url/tags), #tag (exact tag), "quoted phrase" (literal
// text, so a quoted operator word like "or" is searched, not interpreted).
(function (root) {
  function tokenize(q) {
    const toks = [];
    let i = 0;
    while (i < q.length) {
      const c = q[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '(') { toks.push({ t: 'lp' }); i++; continue; }
      if (c === ')') { toks.push({ t: 'rp' }); i++; continue; }
      if (c === '"') {
        let j = i + 1, s = '';
        while (j < q.length && q[j] !== '"') { s += q[j]; j++; }
        toks.push({ t: 'text', v: s });
        i = j < q.length ? j + 1 : j;
        continue;
      }
      if (c === '#') {
        let j = i + 1, s = '';
        while (j < q.length && /[^\s()"]/.test(q[j])) { s += q[j]; j++; }
        toks.push({ t: 'tag', v: s });
        i = j;
        continue;
      }
      let j = i, s = '';
      while (j < q.length && /[^\s()"]/.test(q[j])) { s += q[j]; j++; }
      i = j;
      const up = s.toUpperCase();
      if (up === 'AND' || up === 'OR' || up === 'NOT') toks.push({ t: up });
      else toks.push({ t: 'text', v: s });
    }
    return toks;
  }

  function parse(q) {
    const toks = tokenize(q || '');
    let p = 0;
    const peek = () => toks[p];
    const isTermStart = (tk) => tk && (tk.t === 'text' || tk.t === 'tag' || tk.t === 'NOT' || tk.t === 'lp');
    function parseOr() {
      let left = parseAnd();
      while (peek() && peek().t === 'OR') { p++; const r = parseAnd(); left = { op: 'or', left, right: r }; }
      return left;
    }
    function parseAnd() {
      let left = parseNot();
      while (peek() && peek().t !== 'OR' && peek().t !== 'rp') {
        if (peek().t === 'AND') p++;
        else if (!isTermStart(peek())) break;
        const r = parseNot();
        left = { op: 'and', left, right: r };
      }
      return left;
    }
    function parseNot() {
      if (peek() && peek().t === 'NOT') { p++; return { op: 'not', operand: parseNot() }; }
      return parsePrimary();
    }
    function parsePrimary() {
      const tk = peek();
      if (!tk) return null;
      if (tk.t === 'lp') { p++; const e = parseOr(); if (peek() && peek().t === 'rp') p++; return e; }
      if (tk.t === 'text') { p++; return { op: 'text', v: tk.v }; }
      if (tk.t === 'tag') { p++; return { op: 'tag', v: tk.v }; }
      p++; return null;
    }
    return parseOr();
  }

  function evalNode(node, b) {
    if (!node) return true;
    switch (node.op) {
      case 'and': return evalNode(node.left, b) && evalNode(node.right, b);
      case 'or': return evalNode(node.left, b) || evalNode(node.right, b);
      case 'not': return !evalNode(node.operand, b);
      case 'text': {
        if (!node.v) return true;
        const hay = [b.title, b.description, b.note, b.url, ...(b.tags || [])].join(' ').toLowerCase();
        return hay.includes(node.v.toLowerCase());
      }
      case 'tag': {
        if (!node.v) return true;
        return (b.tags || []).some((t) => String(t).toLowerCase() === node.v.toLowerCase());
      }
      default: return true;
    }
  }

  function matches(query, b) {
    let node = null;
    try { node = parse(query); } catch (e) { node = null; }
    return evalNode(node, b);
  }

  const api = { parse, evalNode, matches, tokenize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Query = api;
})(typeof window !== 'undefined' ? window : globalThis);
