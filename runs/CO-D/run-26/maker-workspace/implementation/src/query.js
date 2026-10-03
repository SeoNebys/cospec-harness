// Search query language (SCN-004).
// Grammar (precedence low -> high): OR, (implicit/explicit) AND, NOT, atom.
// Atoms: plain word (substring across fields), "phrase" (exact substring),
// #tag (exact tag match). A quoted operator word is plain text. Parentheses group.
// Unbalanced parentheses are a hard error.

export function tokenize(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "(") { toks.push({ k: "lp" }); i++; continue; }
    if (c === ")") { toks.push({ k: "rp" }); i++; continue; }
    if (c === '"') {
      let j = i + 1, buf = "";
      while (j < s.length && s[j] !== '"') { buf += s[j]; j++; }
      i = j + 1;
      if (buf.trim()) toks.push({ k: "term", node: { t: "phrase", v: buf } });
      continue;
    }
    if (c === "#") {
      let j = i + 1, buf = "";
      while (j < s.length && !/[\s()"]/.test(s[j])) { buf += s[j]; j++; }
      i = j;
      if (buf) toks.push({ k: "term", node: { t: "tag", v: buf } });
      continue;
    }
    let j = i, buf = "";
    while (j < s.length && !/[\s()"]/.test(s[j])) { buf += s[j]; j++; }
    i = j;
    const up = buf.toUpperCase();
    if (up === "AND") toks.push({ k: "and" });
    else if (up === "OR") toks.push({ k: "or" });
    else if (up === "NOT") toks.push({ k: "not" });
    else toks.push({ k: "term", node: { t: "text", v: buf } });
  }
  return toks;
}

export function parseQuery(str) {
  const T = tokenize(str);
  let P = 0;
  const peek = () => T[P];
  const eat = () => T[P++];
  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().k === "or") { eat(); const r = parseAnd(); left = left ? { t: "or", a: left, b: r } : r; }
    return left;
  }
  function parseAnd() {
    let left = parseNot();
    while (peek() && (peek().k === "and" || peek().k === "term" || peek().k === "not" || peek().k === "lp")) {
      if (peek().k === "and") eat();
      const r = parseNot();
      left = left ? { t: "and", a: left, b: r } : r;
    }
    return left;
  }
  function parseNot() {
    if (peek() && peek().k === "not") { eat(); const n = parseNot(); return n ? { t: "not", n } : null; }
    return parseAtom();
  }
  function parseAtom() {
    const tk = peek();
    if (!tk) return null;
    if (tk.k === "lp") { eat(); const e = parseOr(); if (peek() && peek().k === "rp") eat(); return e; }
    if (tk.k === "term") { eat(); return tk.node; }
    eat();
    return parseAtom();
  }
  return parseOr();
}

export function fieldsOf(b) {
  return {
    text: [b.title, b.description, b.note, b.url, (b.tags || []).join(" ")].join(" ").toLowerCase(),
    tags: (b.tags || []).map((t) => t.toLowerCase()),
  };
}

export function evalNode(n, f) {
  if (!n) return true;
  switch (n.t) {
    case "text": return f.text.includes(n.v.toLowerCase());
    case "phrase": return f.text.includes(n.v.toLowerCase());
    case "tag": return f.tags.includes(n.v.toLowerCase());
    case "not": return !evalNode(n.n, f);
    case "and": return evalNode(n.a, f) && evalNode(n.b, f);
    case "or": return evalNode(n.a, f) || evalNode(n.b, f);
    default: return true;
  }
}

function collectHi(n, neg, out) {
  if (!n) return;
  if (n.t === "text" || n.t === "phrase") { if (!neg) out.text.push(n.v); return; }
  if (n.t === "tag") { if (!neg) out.tag.push(n.v); return; }
  if (n.t === "not") { collectHi(n.n, !neg, out); return; }
  if (n.t === "and" || n.t === "or") { collectHi(n.a, neg, out); collectHi(n.b, neg, out); }
}

export function validateQuery(str) {
  let depth = 0;
  for (const t of tokenize(str)) {
    if (t.k === "lp") depth++;
    else if (t.k === "rp") { depth--; if (depth < 0) return "Check your search — there's a closing parenthesis “)” with no matching opening one."; }
  }
  if (depth > 0) return "Check your search — there may be an unmatched parenthesis.";
  return null;
}

export function compileQuery(str) {
  const q = (str || "").trim();
  if (!q) return { empty: true, test: () => true, hiText: [], hiTag: [] };
  const err = validateQuery(q);
  if (err) return { error: err, test: () => false, hiText: [], hiTag: [] };
  let ast;
  try { ast = parseQuery(q); } catch { return { error: "Check your search — it couldn't be understood.", test: () => false, hiText: [], hiTag: [] }; }
  if (!ast) return { empty: true, test: () => true, hiText: [], hiTag: [] };
  const hi = { text: [], tag: [] };
  collectHi(ast, false, hi);
  return { empty: false, test: (b) => evalNode(ast, fieldsOf(b)), hiText: hi.text, hiTag: hi.tag };
}
