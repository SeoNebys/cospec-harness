// Search query engine (SCN-004): plain words (implicit AND), #tag, "phrase",
// AND / OR / NOT (capitalised), parentheses, case-insensitive.
// UMD wrapper so it works under Node and in the browser (window.LL_query).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LL_query = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function tokenize(input) {
    const tokens = [];
    const re = /\s*("(?:[^"\\]|\\.)*"|\(|\)|#[^\s()]+|[^\s()]+)/g;
    let m;
    while ((m = re.exec(input)) !== null) tokens.push(m[1]);
    return tokens;
  }

  // Operators must be capitalised exactly (AND/OR/NOT); lowercase and/or/not are plain words.
  function isOp(t, name) {
    return t === name;
  }

  // Recursive-descent parser. Precedence: parentheses > NOT > AND > OR.
  function parse(input) {
    const toks = tokenize(input);
    let i = 0;
    const peek = () => toks[i];
    const next = () => toks[i++];

    function parseOr() {
      let n = parseAnd();
      while (isOp(peek(), "OR")) { next(); n = { op: "or", l: n, r: parseAnd() }; }
      return n;
    }
    function parseAnd() {
      let n = parseNot();
      while (peek() !== undefined && peek() !== ")" && !isOp(peek(), "OR")) {
        if (isOp(peek(), "AND")) next();
        n = { op: "and", l: n, r: parseNot() };
      }
      return n;
    }
    function parseNot() {
      if (isOp(peek(), "NOT")) { next(); return { op: "not", x: parseNot() }; }
      return parseAtom();
    }
    function parseAtom() {
      const t = peek();
      if (t === "(") { next(); const n = parseOr(); if (peek() === ")") next(); return n; }
      if (t === ")" || t === undefined) { next(); return { op: "true" }; }
      next();
      if (t[0] === "#") return { op: "tag", val: t.slice(1).toLowerCase() };
      if (t[0] === '"' && t[t.length - 1] === '"') return { op: "phrase", val: t.slice(1, -1).toLowerCase() };
      if (isOp(t, "AND") || isOp(t, "OR") || isOp(t, "NOT")) return { op: "true" };
      return { op: "word", val: t.toLowerCase() };
    }

    if (!toks.length) return { op: "true" };
    return parseOr();
  }

  function haystack(item) {
    return [item.title, item.desc, item.note, item.host, (item.tags || []).join(" ")]
      .filter(Boolean).join(" ").toLowerCase();
  }

  function evalNode(n, item, hay) {
    switch (n.op) {
      case "true": return true;
      case "and": return evalNode(n.l, item, hay) && evalNode(n.r, item, hay);
      case "or": return evalNode(n.l, item, hay) || evalNode(n.r, item, hay);
      case "not": return !evalNode(n.x, item, hay);
      case "tag": return (item.tags || []).some((t) => String(t).toLowerCase() === n.val);
      case "phrase":
      case "word": return hay.includes(n.val);
      default: return true;
    }
  }

  function matches(item, ast) {
    return evalNode(ast, item, haystack(item));
  }

  // Positive plain-word / phrase terms, for highlighting (negated terms excluded).
  function collectTerms(n, out) {
    if (!n) return out;
    if (n.op === "word" || n.op === "phrase") out.push(n.val);
    else if (n.op === "not") { /* skip */ }
    else { collectTerms(n.l, out); collectTerms(n.r, out); collectTerms(n.x, out); }
    return out;
  }

  function filter(items, queryString) {
    const q = String(queryString == null ? "" : queryString).trim();
    if (!q) return items.slice();
    const ast = parse(q);
    return items.filter((it) => matches(it, ast));
  }

  return { parse, matches, filter, collectTerms, haystack };
});
