// SCN-004: search query language. Quoted phrases, AND/OR/NOT, parentheses,
// implicit AND. A bare #tag matches actual tags; a quoted "#x" is literal text.
// Evaluated against a context: { text: <title+desc+url+note lowercased>, tags: [lc] }.

function tokenize(s) {
  const toks = []; let i = 0; const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === "(") { toks.push({ type: "LP" }); i++; continue; }
    if (c === ")") { toks.push({ type: "RP" }); i++; continue; }
    if (c === '"') {
      let j = i + 1, buf = "";
      while (j < n && s[j] !== '"') { buf += s[j]; j++; }
      i = j < n ? j + 1 : j;
      if (buf.trim().length) toks.push({ type: "TERM", value: buf.toLowerCase(), phrase: true });
      continue;
    }
    let k = i, w = "";
    while (k < n && s[k] !== " " && s[k] !== "\t" && s[k] !== "(" && s[k] !== ")" && s[k] !== '"') { w += s[k]; k++; }
    i = k;
    if (!w.length) continue;
    const up = w.toUpperCase();
    if (up === "AND") toks.push({ type: "AND" });
    else if (up === "OR") toks.push({ type: "OR" });
    else if (up === "NOT") toks.push({ type: "NOT" });
    else toks.push({ type: "TERM", value: w.toLowerCase(), phrase: false });
  }
  return toks;
}

function compile(input) {
  const tokens = tokenize(input); let pos = 0;
  const peek = () => tokens[pos];
  function atom() {
    const t = peek();
    if (!t) return null;
    if (t.type === "LP") { pos++; const e = parseOr(); if (peek() && peek().type === "RP") pos++; return e; }
    if (t.type === "RP") return null;
    if (t.type === "AND" || t.type === "OR") { pos++; return atom(); }
    if (t.type === "NOT") { pos++; const a = atom(); return a ? (ctx) => !a(ctx) : null; }
    pos++;
    if (t.value.charAt(0) === "#" && !t.phrase) {
      const tag = t.value.slice(1);
      return (ctx) => ctx.tags.indexOf(tag) >= 0;
    }
    const term = t.value;
    return (ctx) => ctx.text.indexOf(term) >= 0;
  }
  function parseAnd() {
    let left = atom();
    while (peek()) {
      const t = peek();
      if (t.type === "RP" || t.type === "OR") break;
      if (t.type === "AND") pos++;
      const right = atom();
      if (right) { const l = left, r = right; left = l ? (ctx) => l(ctx) && r(ctx) : r; }
    }
    return left;
  }
  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().type === "OR") {
      pos++; const right = parseAnd();
      if (right) { const l = left, r = right; left = l ? (ctx) => l(ctx) || r(ctx) : r; }
    }
    return left;
  }
  return parseOr();
}

export function buildMatcher(raw) {
  raw = String(raw || "").trim();
  if (!raw) return null;
  try { const m = compile(raw); if (m) return m; } catch { /* fall through */ }
  const t = raw.toLowerCase();
  return (ctx) => ctx.text.indexOf(t) >= 0;
}

export function ctxFor(it) {
  return {
    text: (it.title + " " + (it.description || "") + " " + it.url + " " + (it.note || "")).toLowerCase(),
    tags: (it.tags || []).map((t) => String(t).toLowerCase()),
  };
}

// Combined query + include/exclude tag matching (SCN-004 + SCN-010).
export function matchesAll(it, matcher, includeTags, excludeTags) {
  const ctx = ctxFor(it);
  if (matcher && !matcher(ctx)) return false;
  if (includeTags && includeTags.length) for (const t of includeTags) if (ctx.tags.indexOf(t) < 0) return false;
  if (excludeTags && excludeTags.length) for (const t of excludeTags) if (ctx.tags.indexOf(t) >= 0) return false;
  return true;
}
