export function tokenize(query) {
  const raw = String(query || '').trim();
  if (!raw) return [];
  if (((raw.match(/"/g) || []).length % 2) !== 0) throw new Error('That search is not complete yet.');
  const tokens = raw.match(/"[^"]*"|#[\p{L}\p{N}_-]+|\(|\)|\bAND\b|\bOR\b|\bNOT\b|[^\s()]+/giu) || [];
  return tokens;
}

export function compileSearch(query) {
  const ts = tokenize(query);
  if (!ts.length) return () => true;
  let i = 0;
  const primary = () => {
    if (ts[i] === '(') {
      i += 1;
      const fn = or();
      if (ts[i] !== ')') throw new Error('Finish the search condition or close the parentheses.');
      i += 1;
      return fn;
    }
    const token = ts[i++];
    if (!token || token === ')') throw new Error('Finish the search condition.');
    if (token.startsWith('"')) {
      const phrase = token.slice(1, -1).toLocaleLowerCase();
      return item => item.searchText.includes(phrase);
    }
    if (token.startsWith('#')) {
      const label = token.slice(1).toLocaleLowerCase();
      return item => item.labels.some(value => value.toLocaleLowerCase() === label);
    }
    const word = token.toLocaleLowerCase();
    return item => item.searchText.includes(word);
  };
  const unary = () => {
    if ((ts[i] || '').toUpperCase() === 'NOT') { i += 1; const fn = unary(); return item => !fn(item); }
    return primary();
  };
  const and = () => {
    let fn = unary();
    while ((ts[i] || '').toUpperCase() === 'AND') { i += 1; const left = fn, right = unary(); fn = item => left(item) && right(item); }
    return fn;
  };
  const or = () => {
    let fn = and();
    while ((ts[i] || '').toUpperCase() === 'OR') { i += 1; const left = fn, right = and(); fn = item => left(item) || right(item); }
    return fn;
  };
  const result = or();
  if (i < ts.length) throw new Error('Use AND or OR between search conditions.');
  return result;
}

export function searchable(bookmark) {
  return {
    labels: bookmark.labels || [],
    searchText: [bookmark.title, bookmark.description, bookmark.source, bookmark.note].filter(Boolean).join(' ').toLocaleLowerCase()
  };
}
