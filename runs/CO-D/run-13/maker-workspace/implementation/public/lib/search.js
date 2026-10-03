// Query language for search (SCN-008): ordinary words (all must match),
// "exact phrases", #tag (exact whole tag), AND / OR / NOT and parentheses.
// Precedence: NOT > AND > OR. Operator words are literal only when quoted.
// Shared by the server and the browser.
(function (root) {
  'use strict';

  function tokenize(q) {
    var toks = [], i = 0, n = q.length;
    function sp(c) { return c === ' ' || c === '\t' || c === '\n' || c === '\r'; }
    function stop(c) { return sp(c) || c === '(' || c === ')' || c === '"'; }
    while (i < n) {
      var c = q[i];
      if (sp(c)) { i++; continue; }
      if (c === '(') { toks.push({ t: '(' }); i++; continue; }
      if (c === ')') { toks.push({ t: ')' }); i++; continue; }
      if (c === '"') { i++; var s = ''; while (i < n && q[i] !== '"') { s += q[i]; i++; } if (i < n) i++; toks.push({ t: 'term', kind: 'phrase', v: s }); continue; }
      if (c === '#') { i++; var g = ''; while (i < n && !stop(q[i])) { g += q[i]; i++; } toks.push({ t: 'term', kind: 'tag', v: g }); continue; }
      var w = ''; while (i < n && !stop(q[i])) { w += q[i]; i++; }
      var up = w.toUpperCase();
      if (up === 'AND') toks.push({ t: 'AND' });
      else if (up === 'OR') toks.push({ t: 'OR' });
      else if (up === 'NOT') toks.push({ t: 'NOT' });
      else toks.push({ t: 'term', kind: 'text', v: w });
    }
    return toks;
  }

  function parse(q) {
    var toks = tokenize(q), pos = 0;
    function peek() { return toks[pos]; }
    function starts(tk) { return tk && (tk.t === 'term' || tk.t === 'NOT' || tk.t === '('); }
    function pOr() { var node = pAnd(); while (peek() && peek().t === 'OR') { pos++; node = { op: 'or', l: node, r: pAnd() }; } return node; }
    function pAnd() {
      var node = pNot();
      while (peek()) {
        if (peek().t === 'AND') { pos++; node = { op: 'and', l: node, r: pNot() }; }
        else if (starts(peek())) { node = { op: 'and', l: node, r: pNot() }; }
        else break;
      }
      return node;
    }
    function pNot() { if (peek() && peek().t === 'NOT') { pos++; return { op: 'not', c: pNot() }; } return pAtom(); }
    function pAtom() {
      var tk = peek();
      if (!tk) return { op: 'true' };
      if (tk.t === '(') { pos++; var inner = pOr(); if (peek() && peek().t === ')') pos++; return inner; }
      if (tk.t === 'term') { pos++; return { op: 'term', kind: tk.kind, v: tk.v }; }
      pos++; return { op: 'true' };
    }
    return pOr();
  }

  // hay = lowercased searchable text; tags = array of tag strings.
  function evalNode(node, hay, tags) {
    if (!node) return true;
    switch (node.op) {
      case 'true': return true;
      case 'or': return evalNode(node.l, hay, tags) || evalNode(node.r, hay, tags);
      case 'and': return evalNode(node.l, hay, tags) && evalNode(node.r, hay, tags);
      case 'not': return !evalNode(node.c, hay, tags);
      case 'term':
        if (node.kind === 'tag') {
          var x = node.v.toLowerCase();
          if (!x) return true;
          return tags.some(function (t) { return t.toLowerCase() === x; });
        }
        var v = node.v.toLowerCase();
        if (!v) return true;
        return hay.indexOf(v) >= 0;
      default: return true;
    }
  }

  // Positive (non-negated) text/phrase terms, for result highlighting.
  function highlightTerms(node, neg, out) {
    if (!node) return out;
    if (node.op === 'term') { if (!neg && (node.kind === 'text' || node.kind === 'phrase') && node.v) out.push(node.v.toLowerCase()); return out; }
    if (node.op === 'not') { return highlightTerms(node.c, !neg, out); }
    if (node.op === 'and' || node.op === 'or') { highlightTerms(node.l, neg, out); highlightTerms(node.r, neg, out); }
    return out;
  }

  // Convenience: the searchable text for a bookmark (SCN-008 fields).
  function haystack(b) {
    return [b.title, b.description, (b.tags || []).join(' '), b.note, b.siteName, b.url]
      .join(' \n ').toLowerCase();
  }

  var api = {
    parse: parse,
    tokenize: tokenize,
    matches: function (query, b) {
      if (!query || !query.trim()) return true;
      return evalNode(parse(query), haystack(b), b.tags || []);
    },
    evalNode: evalNode,
    highlightTerms: function (query) { return highlightTerms(parse(query), false, []); },
    haystack: haystack,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SearchQuery = api;
})(typeof self !== 'undefined' ? self : this);
