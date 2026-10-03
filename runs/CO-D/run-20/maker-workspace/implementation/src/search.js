// Search query language (SCN-004, SCN-008).
// - Case-insensitive substring matching over title, description, address, notes
//   and tags.
// - "quoted phrases" match literally (and force operator words to be literal).
// - AND / OR / NOT combine terms (recognised in any capitalisation when unquoted);
//   parentheses group; adjacent plain terms default to AND.
// - #tag matches an exact tag on the bookmark.

// ---- tokenizer --------------------------------------------------------------
function tokenize(input) {
  const tokens = [];
  const s = String(input || '');
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(') { tokens.push({ t: 'LP' }); i++; continue; }
    if (c === ')') { tokens.push({ t: 'RP' }); i++; continue; }
    if (c === '"') {
      let j = i + 1, buf = '';
      while (j < s.length && s[j] !== '"') { buf += s[j]; j++; }
      i = j < s.length ? j + 1 : j;
      tokens.push({ t: 'PHRASE', v: buf });
      continue;
    }
    let w = '';
    while (i < s.length && !/\s/.test(s[i]) && s[i] !== '(' && s[i] !== ')' && s[i] !== '"') {
      w += s[i]; i++;
    }
    const up = w.toUpperCase();
    if (up === 'AND' || up === 'OR' || up === 'NOT') tokens.push({ t: 'OP', v: up });
    else if (w[0] === '#' && w.length > 1) tokens.push({ t: 'TAG', v: w.slice(1) });
    else tokens.push({ t: 'WORD', v: w });
  }
  return tokens;
}

// Text a bookmark is searched over. Notes and tags are included.
export function searchableText(item) {
  return [
    item.title || '',
    item.description || '',
    item.url || '',
    item.notes || '',
    (item.tags || []).join(' '),
  ].join(' ').toLowerCase();
}

// ---- parser: OR > (implicit) AND > NOT > term -------------------------------
export function compile(query) {
  const tokens = tokenize(query);
  let pos = 0;
  const literals = [];
  const peek = () => tokens[pos];

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().t === 'OP' && peek().v === 'OR') {
      pos++;
      const right = parseAnd();
      const l = left, r = right;
      left = (it) => l(it) || r(it);
    }
    return left;
  }
  function parseAnd() {
    let left = parseNot();
    while (peek() && !(peek().t === 'OP' && peek().v === 'OR') && peek().t !== 'RP') {
      if (peek().t === 'OP' && peek().v === 'AND') pos++;
      const right = parseNot();
      const l = left, r = right;
      left = (it) => l(it) && r(it);
    }
    return left;
  }
  function parseNot() {
    if (peek() && peek().t === 'OP' && peek().v === 'NOT') {
      pos++;
      const operand = parseNot();
      return (it) => !operand(it);
    }
    return parseTerm();
  }
  function parseTerm() {
    const tk = peek();
    if (!tk) return () => true;
    if (tk.t === 'LP') {
      pos++;
      const e = parseOr();
      if (peek() && peek().t === 'RP') pos++;
      return e;
    }
    if (tk.t === 'RP') { pos++; return () => true; }
    pos++;
    if (tk.t === 'TAG') {
      const tag = tk.v.toLowerCase();
      return (it) => (it.tags || []).some((x) => String(x).toLowerCase() === tag);
    }
    const needle = String(tk.v || '').toLowerCase();
    if (needle) literals.push(needle);
    return needle === '' ? () => true : (it) => searchableText(it).indexOf(needle) !== -1;
  }

  const predicate = tokens.length ? parseOr() : () => true;
  return { test: predicate, literals };
}

export function search(items, query) {
  const { test } = compile(query);
  return items.filter(test);
}
