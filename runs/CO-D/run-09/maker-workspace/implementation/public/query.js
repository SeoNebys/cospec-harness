/*
 * Search query language for bookmarks.
 * Implements SCN-006 (broad, case-insensitive, implicit-AND search) and
 * SCN-007 (#labels, "phrases", AND/OR/NOT, parentheses, quoted operators literal).
 * Shared by the browser (window.BMQuery) and Node tests (module.exports).
 */
(function (root) {
  function haystack(b) {
    return [b.title, b.desc, b.note, (b.tags || []).join(" "), b.url, b.domain]
      .join(" ")
      .toLowerCase();
  }

  // --- tokenizer ---
  function tokenize(q) {
    const toks = [];
    const stop = " \t()\"";
    let i = 0;
    while (i < q.length) {
      const c = q[i];
      if (c === " " || c === "\t") { i++; continue; }
      if (c === "(") { toks.push({ t: "(" }); i++; continue; }
      if (c === ")") { toks.push({ t: ")" }); i++; continue; }
      if (c === '"') {
        let j = i + 1, s = "";
        while (j < q.length && q[j] !== '"') { s += q[j]; j++; }
        i = j < q.length ? j + 1 : j;
        toks.push({ t: "TERM", kind: "phrase", v: s });
        continue;
      }
      if (c === "#") {
        let j = i + 1, s = "";
        if (q[j] === '"') {
          j++;
          while (j < q.length && q[j] !== '"') { s += q[j]; j++; }
          i = j < q.length ? j + 1 : j;
        } else {
          while (j < q.length && !stop.includes(q[j])) { s += q[j]; j++; }
          i = j;
        }
        toks.push({ t: "TERM", kind: "label", v: s });
        continue;
      }
      let j = i, s = "";
      while (j < q.length && !stop.includes(q[j])) { s += q[j]; j++; }
      i = j;
      const kw = s.toUpperCase();
      if (kw === "AND") toks.push({ t: "AND" });
      else if (kw === "OR") toks.push({ t: "OR" });
      else if (kw === "NOT") toks.push({ t: "NOT" });
      else toks.push({ t: "TERM", kind: "word", v: s });
    }
    return toks;
  }

  // --- recursive-descent parser (precedence: NOT > AND > OR) ---
  function parse(toks) {
    let p = 0;
    const peek = () => toks[p];
    const eat = () => toks[p++];
    function pOr() {
      let l = pAnd();
      while (peek() && peek().t === "OR") { eat(); l = { op: "or", l, r: pAnd() }; }
      return l;
    }
    function pAnd() {
      let l = pNot();
      while (peek() && (peek().t === "AND" || peek().t === "TERM" || peek().t === "(" || peek().t === "NOT")) {
        if (peek().t === "AND") eat();
        l = { op: "and", l, r: pNot() };
      }
      return l;
    }
    function pNot() {
      if (peek() && peek().t === "NOT") { eat(); return { op: "not", c: pNot() }; }
      return pPrim();
    }
    function pPrim() {
      const tk = peek();
      if (!tk) throw new Error("unexpected end");
      if (tk.t === "(") {
        eat();
        const e = pOr();
        if (peek() && peek().t === ")") eat(); else throw new Error("missing )");
        return e;
      }
      if (tk.t === "TERM") { eat(); return { op: "term", kind: tk.kind, v: tk.v }; }
      throw new Error("unexpected token");
    }
    const ast = pOr();
    if (p !== toks.length) throw new Error("trailing tokens");
    return ast;
  }

  function evalAst(n, b, h) {
    switch (n.op) {
      case "or": return evalAst(n.l, b, h) || evalAst(n.r, b, h);
      case "and": return evalAst(n.l, b, h) && evalAst(n.r, b, h);
      case "not": return !evalAst(n.c, b, h);
      case "term":
        if (n.kind === "label") return (b.tags || []).some((t) => t.toLowerCase() === n.v.toLowerCase());
        return h.includes((n.v || "").toLowerCase());
    }
    return false;
  }

  function collectHighlights(n, negated, out) {
    if (!n) return;
    if (n.op === "or" || n.op === "and") { collectHighlights(n.l, negated, out); collectHighlights(n.r, negated, out); }
    else if (n.op === "not") collectHighlights(n.c, !negated, out);
    else if (n.op === "term" && !negated && n.v) out.push(n.v.toLowerCase());
  }

  // Compile a query string into { match(bookmark), highlights[] }.
  // On an uninterpretable query, falls back to a plain all-words AND (SCN-007).
  function compile(q) {
    const query = (q || "").trim();
    if (!query) return { match: () => true, highlights: [] };
    try {
      const ast = parse(tokenize(query));
      const out = [];
      collectHighlights(ast, false, out);
      return {
        match: (b) => evalAst(ast, b, haystack(b)),
        highlights: Array.from(new Set(out.filter(Boolean))),
      };
    } catch (e) {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const literal = words.filter((w) => !["and", "or", "not"].includes(w));
      return {
        match: (b) => { const h = haystack(b); return words.every((w) => h.includes(w)); },
        highlights: literal,
      };
    }
  }

  const api = { haystack, tokenize, parse, compile };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.BMQuery = api;
})(typeof window !== "undefined" ? window : null);
