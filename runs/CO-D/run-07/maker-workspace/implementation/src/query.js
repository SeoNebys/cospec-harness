// Search expression engine (SCN-005).
// Grammar (precedence: NOT > AND > OR; parentheses override; adjacency = AND):
//   or   := and (OR and)*
//   and  := not ((AND)? not)*
//   not  := (NOT)? atom
//   atom := "(" or ")" | TERM
// Terms: #tag (exact tag), "phrase" (literal substring), word (substring).
// AND/OR/NOT are operators only when bare (any case); quoted they are literal text.
// Case-insensitive throughout.

export function tokenize(s) {
  const toks = [];
  let i = 0;
  const isWord = (c) => c && !/\s/.test(c) && c !== "(" && c !== ")" && c !== '"';
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "(") { toks.push({ t: "(" }); i++; continue; }
    if (c === ")") { toks.push({ t: ")" }); i++; continue; }
    if (c === '"') {
      let j = i + 1, v = "";
      while (j < s.length && s[j] !== '"') { v += s[j]; j++; }
      i = j < s.length ? j + 1 : j;
      toks.push({ t: "term", kind: "phrase", v });
      continue;
    }
    if (c === "#") {
      let j = i + 1, v = "";
      while (j < s.length && isWord(s[j]) && s[j] !== "#") { v += s[j]; j++; }
      i = j;
      toks.push({ t: "term", kind: "tag", v });
      continue;
    }
    let j = i, v = "";
    while (j < s.length && isWord(s[j])) { v += s[j]; j++; }
    i = j;
    const up = v.toUpperCase();
    if (up === "AND" || up === "OR" || up === "NOT") toks.push({ t: up });
    else toks.push({ t: "term", kind: "word", v });
  }
  return toks;
}

// Returns a predicate (ctx) => boolean, or throws on a malformed expression.
export function compileStrict(s) {
  const toks = tokenize(s);
  let p = 0;
  const peek = () => toks[p];
  const eat = () => toks[p++];

  const termNode = (tk) => {
    const v = String(tk.v).toLowerCase();
    if (tk.kind === "tag") return (ctx) => ctx.tags.includes(v);
    return (ctx) => v === "" || ctx.text.includes(v);
  };
  function atom() {
    const tk = peek();
    if (!tk) throw new Error("expected term");
    if (tk.t === "(") {
      eat();
      const n = orExpr();
      if (!peek() || peek().t !== ")") throw new Error("missing )");
      eat();
      return n;
    }
    if (tk.t === "term") { eat(); return termNode(tk); }
    throw new Error("unexpected " + tk.t);
  }
  function notExpr() {
    if (peek() && peek().t === "NOT") { eat(); const n = notExpr(); return (ctx) => !n(ctx); }
    return atom();
  }
  function andExpr() {
    let n = notExpr();
    while (peek() && (peek().t === "AND" || peek().t === "term" || peek().t === "NOT" || peek().t === "(")) {
      if (peek().t === "AND") eat();
      const r = notExpr();
      const a = n; n = (ctx) => a(ctx) && r(ctx);
    }
    return n;
  }
  function orExpr() {
    let n = andExpr();
    while (peek() && peek().t === "OR") {
      eat();
      const r = andExpr();
      const a = n; n = (ctx) => a(ctx) || r(ctx);
    }
    return n;
  }
  const pred = orExpr();
  if (p !== toks.length) throw new Error("trailing input");
  return pred;
}

// Safe wrapper: { match, fallback }. On a malformed advanced expression we fall
// back to a plain case-insensitive substring search and flag fallback=true.
export function buildQuery(q) {
  const s = String(q || "").trim();
  if (!s) return { match: () => true, fallback: false };
  try {
    const pred = compileStrict(s);
    return { match: (ctx) => pred(ctx), fallback: false };
  } catch {
    const l = s.toLowerCase();
    return { match: (ctx) => ctx.text.includes(l), fallback: true };
  }
}

// Build the searchable context for a bookmark: text spans title, description,
// note, tags, site and url; tags are matched exactly (case-insensitive).
export function contextFor(bm) {
  const text = [bm.title, bm.description, bm.note, bm.site, bm.url, (bm.tags || []).join(" ")]
    .join(" ").toLowerCase();
  return { text, tags: (bm.tags || []).map((t) => String(t).toLowerCase()) };
}
