/*
 * Search query language (SCN-008, SCN-009).
 * Universal module: usable in Node (module.exports) and the browser (window.BookmarkSearch).
 *
 * Grammar (precedence: NOT > AND > OR; adjacent terms imply AND):
 *   expr    := or
 *   or      := and (OR and)*
 *   and     := not ( (AND)? not )*
 *   not     := NOT not | primary
 *   primary := '(' expr ')' | #tag | "phrase" | word
 *
 * A term is a #tag (exact, case-insensitive tag match) or text (substring in
 * title, link, description and note, case-insensitive). Bare operators and, or,
 * not are case-insensitive; a quoted "or"/"and"/"not" is an ordinary word.
 */
(function (root) {
  function tokenize(s) {
    const toks = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '(') { toks.push({ t: '(' }); i++; continue; }
      if (c === ')') { toks.push({ t: ')' }); i++; continue; }
      if (c === '"') {
        let j = i + 1, v = '';
        while (j < s.length && s[j] !== '"') { v += s[j++]; }
        if (j >= s.length) throw new Error('unterminated quote');
        i = j + 1;
        toks.push({ t: 'term', kind: 'text', v: v.toLowerCase() });
        continue;
      }
      if (c === '#') {
        let j = i + 1, v = '';
        while (j < s.length && /[^\s()]/.test(s[j])) { v += s[j++]; }
        i = j;
        toks.push({ t: 'term', kind: 'tag', v: v.toLowerCase() });
        continue;
      }
      let j = i, v = '';
      while (j < s.length && /[^\s()]/.test(s[j])) { v += s[j++]; }
      i = j;
      const up = v.toUpperCase();
      if (up === 'AND' || up === 'OR' || up === 'NOT') toks.push({ t: up });
      else toks.push({ t: 'term', kind: 'text', v: v.toLowerCase() });
    }
    return toks;
  }

  function parse(toks) {
    let p = 0;
    const peek = () => toks[p];
    const isTermStart = () => {
      const k = peek();
      return k && (k.t === 'term' || k.t === '(' || k.t === 'NOT');
    };
    function parseOr() {
      let node = parseAnd();
      while (peek() && peek().t === 'OR') { p++; node = { op: 'or', l: node, r: parseAnd() }; }
      return node;
    }
    function parseAnd() {
      let node = parseNot();
      while (peek() && (peek().t === 'AND' || (peek().t !== 'OR' && peek().t !== ')' && isTermStart()))) {
        if (peek().t === 'AND') p++;
        node = { op: 'and', l: node, r: parseNot() };
      }
      return node;
    }
    function parseNot() {
      if (peek() && peek().t === 'NOT') { p++; return { op: 'not', c: parseNot() }; }
      return parsePrimary();
    }
    function parsePrimary() {
      const k = peek();
      if (!k) throw new Error('unexpected end');
      if (k.t === '(') {
        p++;
        const n = parseOr();
        if (!peek() || peek().t !== ')') throw new Error('missing )');
        p++;
        return n;
      }
      if (k.t === 'term') { p++; return { op: 'term', kind: k.kind, v: k.v }; }
      throw new Error('unexpected ' + k.t);
    }
    const tree = parseOr();
    if (p !== toks.length) throw new Error('trailing input');
    return tree;
  }

  function evalNode(node, b) {
    switch (node.op) {
      case 'or': return evalNode(node.l, b) || evalNode(node.r, b);
      case 'and': return evalNode(node.l, b) && evalNode(node.r, b);
      case 'not': return !evalNode(node.c, b);
      case 'term':
        if (node.kind === 'tag') return (b.tags || []).some(t => t.toLowerCase() === node.v);
        return [b.title, b.url, b.desc, b.note].join(' ').toLowerCase().includes(node.v);
    }
    return false;
  }

  /**
   * Compile a query string into a predicate. Throws on an unreadable query.
   * An empty/whitespace query compiles to a predicate that matches everything.
   */
  function compile(query) {
    const raw = (query || '').trim();
    if (!raw) return () => true;
    const tree = parse(tokenize(raw));
    return (b) => evalNode(tree, b);
  }

  const api = { tokenize, parse, evalNode, compile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BookmarkSearch = api;
})(typeof window !== 'undefined' ? window : this);
