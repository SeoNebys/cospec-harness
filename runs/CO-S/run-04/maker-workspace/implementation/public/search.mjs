// Search query language for bookmarks (SCN-005).
//
// Grammar (case-insensitive), precedence NOT > AND > OR, implicit AND between
// adjacent terms:
//   orExpr  := andExpr (OR andExpr)*
//   andExpr := notExpr ((AND)? notExpr)*
//   notExpr := (NOT | -) notExpr | atom
//   atom    := '(' orExpr ')' | term
//   term    := "quoted phrase" | #tag | word
//
// A term is one of:
//   #tag           -> EXACT (case-insensitive) match against the record's tags
//   "quoted phrase"-> loose substring match of the phrase against the haystack
//   word           -> loose substring match against the haystack
//
// buildMatcher(input) returns a predicate over a "record":
//   { haystack: string (already lowercased), tags: string[] (already lowercased) }
// or null when the input is empty. A malformed query falls back to a plain
// substring match of the whole input (SCN-005 assumption).

export function buildMatcher(input) {
  const source = String(input == null ? "" : input);
  const tokens = tokenize(source);
  if (tokens.length === 0) return null;

  let pos = 0;
  const peek = () => tokens[pos];
  const eat = () => tokens[pos++];
  const isKeyword = (t, word) => t && t.type === "word" && t.value.toUpperCase() === word;

  function parseOr() {
    let left = parseAnd();
    while (isKeyword(peek(), "OR")) {
      eat();
      const right = parseAnd();
      const l = left;
      left = (r) => l(r) || right(r);
    }
    return left;
  }

  function parseAnd() {
    let left = parseNot();
    while (peek() && !isKeyword(peek(), "OR") && peek().type !== "rparen") {
      if (isKeyword(peek(), "AND")) eat();
      const right = parseNot();
      const l = left;
      left = (r) => l(r) && right(r);
    }
    return left;
  }

  function parseNot() {
    const t = peek();
    if (isKeyword(t, "NOT") || (t && t.type === "neg")) {
      eat();
      const inner = parseNot();
      return (r) => !inner(r);
    }
    return parseAtom();
  }

  function parseAtom() {
    const t = peek();
    if (t && t.type === "lparen") {
      eat();
      const inner = parseOr();
      if (peek() && peek().type === "rparen") eat();
      return inner;
    }
    eat();
    return termPredicate(t);
  }

  try {
    const predicate = parseOr();
    // Defensive: if parsing left tokens unconsumed in a weird way, still usable.
    return predicate;
  } catch (err) {
    const needle = source.trim().toLowerCase();
    return (r) => r.haystack.includes(needle);
  }
}

function termPredicate(token) {
  if (!token) return () => true;
  if (token.type === "tag") {
    const name = token.value.toLowerCase();
    return (r) => r.tags.includes(name);
  }
  // word or phrase
  const needle = token.value.toLowerCase();
  if (!needle) return () => true;
  return (r) => r.haystack.includes(needle);
}

function tokenize(input) {
  const tokens = [];
  const re = /\s*("[^"]*"|#[^\s()]+|\(|\)|-(?=\S)|[^\s()]+)/g;
  let m;
  while ((m = re.exec(input)) !== null) {
    const raw = m[1];
    if (raw === "(") tokens.push({ type: "lparen" });
    else if (raw === ")") tokens.push({ type: "rparen" });
    else if (raw === "-") tokens.push({ type: "neg" });
    else if (raw.startsWith("#")) tokens.push({ type: "tag", value: raw.slice(1) });
    else if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
      tokens.push({ type: "word", value: raw.slice(1, -1) });
    } else {
      tokens.push({ type: "word", value: raw });
    }
  }
  return tokens;
}

// Build the normalized record a matcher expects from a bookmark object.
export function toRecord(bookmark) {
  const tags = Array.isArray(bookmark.tags) ? bookmark.tags : [];
  const haystack = [
    bookmark.title,
    bookmark.description,
    bookmark.note,
    bookmark.url,
    tags.join(" "),
    bookmark.host,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return { haystack, tags: tags.map((t) => String(t).toLowerCase()) };
}
