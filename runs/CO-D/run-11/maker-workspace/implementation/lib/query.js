// Search query language shared by the browser UI and Node tests.
// Grammar: bare words (substring), "quoted phrases", #tag, AND/OR/NOT (any case),
// parentheses. Implicit AND between adjacent terms. Precedence: NOT > AND > OR.
// A quoted token is always literal, even if it spells an operator.
// Malformed queries fall back to a plain all-words match.
(function () {
  function tokenize(q) {
    var toks = [], i = 0, n = q.length;
    while (i < n) {
      var c = q[i];
      if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
      if (c === '(') { toks.push({ t: '(' }); i++; continue; }
      if (c === ')') { toks.push({ t: ')' }); i++; continue; }
      if (c === '"') {
        var j = i + 1, s = '';
        while (j < n && q[j] !== '"') { s += q[j++]; }
        i = (j < n) ? j + 1 : j;
        toks.push({ t: 'term', kind: 'phrase', val: s.toLowerCase() });
        continue;
      }
      if (c === '#') {
        var k = i + 1, tg = '';
        while (k < n && /[^\s()"]/.test(q[k])) { tg += q[k++]; }
        i = k;
        toks.push({ t: 'term', kind: 'tag', val: tg.toLowerCase() });
        continue;
      }
      var m = i, w = '';
      while (m < n && /[^\s()"]/.test(q[m])) { w += q[m++]; }
      i = m;
      var up = w.toUpperCase();
      if (up === 'AND' || up === 'OR' || up === 'NOT') toks.push({ t: 'op', val: up });
      else toks.push({ t: 'term', kind: 'word', val: w.toLowerCase() });
    }
    return toks;
  }

  function parse(toks) {
    var pos = 0;
    function peek() { return toks[pos]; }
    function parseOr() {
      var node = parseAnd();
      while (peek() && peek().t === 'op' && peek().val === 'OR') { pos++; node = { op: 'or', l: node, r: parseAnd() }; }
      return node;
    }
    function parseAnd() {
      var node = parseNot();
      while (peek()) {
        var p = peek();
        if (p.t === 'op' && p.val === 'OR') break;
        if (p.t === ')') break;
        if (p.t === 'op' && p.val === 'AND') { pos++; node = { op: 'and', l: node, r: parseNot() }; }
        else { node = { op: 'and', l: node, r: parseNot() }; } // implicit AND
      }
      return node;
    }
    function parseNot() {
      if (peek() && peek().t === 'op' && peek().val === 'NOT') { pos++; return { op: 'not', x: parseNot() }; }
      return parseAtom();
    }
    function parseAtom() {
      var p = peek();
      if (!p) throw new Error('eof');
      if (p.t === '(') { pos++; var node = parseOr(); if (!peek() || peek().t !== ')') throw new Error('paren'); pos++; return node; }
      if (p.t === 'term') { pos++; return { op: 'term', term: p }; }
      throw new Error('unexpected');
    }
    var tree = parseOr();
    if (pos !== toks.length) throw new Error('trailing');
    return tree;
  }

  function hayOf(it) {
    return (
      (it.title || '') + ' ' + (it.description || '') + ' ' + (it.note || '') + ' ' +
      (it.url || '') + ' ' + ((it.tags || []).join(' '))
    ).toLowerCase();
  }

  function evalTree(node, it) {
    switch (node.op) {
      case 'or': return evalTree(node.l, it) || evalTree(node.r, it);
      case 'and': return evalTree(node.l, it) && evalTree(node.r, it);
      case 'not': return !evalTree(node.x, it);
      case 'term': {
        var tm = node.term;
        if (tm.kind === 'tag') return (it.tags || []).indexOf(tm.val) >= 0;
        if (!tm.val) return true;
        return hayOf(it).indexOf(tm.val) >= 0;
      }
    }
    return true;
  }

  function compile(q) {
    q = q || '';
    if (!q.trim()) return { tree: null, words: [] };
    var toks = tokenize(q);
    var words = toks.filter(function (t) { return t.t === 'term' && t.kind !== 'tag' && t.val; })
                    .map(function (t) { return t.val; });
    try {
      return { tree: parse(toks), words: words };
    } catch (e) {
      var plain = q.toLowerCase().replace(/[()"#]/g, ' ').split(/\s+/)
        .filter(function (w) { return w && w !== 'and' && w !== 'or' && w !== 'not'; });
      return { tree: null, plain: plain, words: plain };
    }
  }

  function matches(it, q) {
    var c = compile(q);
    if (c.tree) return evalTree(c.tree, it);
    if (c.plain) return c.plain.every(function (w) { return hayOf(it).indexOf(w) >= 0; });
    return true;
  }

  function terms(q) { return compile(q).words || []; }

  var api = { matches: matches, terms: terms, compile: compile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else this.BMQuery = api;
}).call(typeof window !== 'undefined' ? window : this);
