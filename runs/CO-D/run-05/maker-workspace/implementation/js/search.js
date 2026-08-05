// Search: multiple words all must appear, in any order (each word narrows);
// "quoted text" is the exact-phrase special case (SCN-006). Highlighter returns
// DOM-free segments so it can be unit-tested and rendered by any UI.

// Split a query into lowercased tokens; a "quoted run" stays one phrase token.
export function tokenize(query) {
  const tokens = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m;
  while ((m = re.exec(String(query || ""))) !== null) {
    const s = (m[1] !== undefined ? m[1] : m[2]).trim().toLowerCase();
    if (s) tokens.push(s);
  }
  return tokens;
}

// Everything searchable about a bookmark, incl. the personal note (SCN-013).
export function haystack(item) {
  return [item.title, item.summary, item.site || item.host, item.note]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matches(item, tokens) {
  if (!tokens.length) return true;
  const hay = haystack(item);
  return tokens.every((t) => hay.includes(t));
}

// Break text into [{text, hit}] segments where hit marks a matched token.
export function highlightSegments(text, tokens) {
  const src = String(text == null ? "" : text);
  if (!tokens.length || !src) return [{ text: src, hit: false }];
  const esc = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp("(" + esc.join("|") + ")", "gi");
  const out = [];
  let last = 0, m;
  while ((m = re.exec(src)) !== null) {
    if (m.index === re.lastIndex) re.lastIndex++;
    if (m.index > last) out.push({ text: src.slice(last, m.index), hit: false });
    out.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ text: src.slice(last), hit: false });
  return out;
}
