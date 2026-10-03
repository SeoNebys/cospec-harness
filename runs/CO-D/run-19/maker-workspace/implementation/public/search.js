export function tokenizeQuery(query) {
  const tokens = [];
  let index = 0;
  let unclosedQuote = false;
  while (index < query.length) {
    while (/\s/.test(query[index] || '')) index += 1;
    if (index >= query.length) break;
    let excluded = false;
    if (query[index] === '-') {
      excluded = true;
      index += 1;
    }
    if (query[index] === '"') {
      index += 1;
      const end = query.indexOf('"', index);
      if (end === -1) {
        tokens.push({ value: query.slice(index).trim(), exact: true, excluded, unclosed: true });
        unclosedQuote = true;
        break;
      }
      tokens.push({ value: query.slice(index, end), exact: true, excluded });
      index = end + 1;
      continue;
    }
    let end = index;
    while (end < query.length && !/\s/.test(query[end])) end += 1;
    const value = query.slice(index, end);
    tokens.push({ value, exact: false, excluded, operator: value.toUpperCase() === 'OR' });
    index = end;
  }
  return { tokens: tokens.filter((token) => token.value), unclosedQuote };
}

export function searchableText(bookmark) {
  return [bookmark.title, bookmark.description, bookmark.site, bookmark.url, ...(bookmark.labels || [])].join(' ').toLowerCase();
}

function tokenMatches(bookmark, token) {
  const lowered = token.value.toLowerCase();
  let matches;
  if (lowered.startsWith('label:')) {
    const wanted = lowered.slice(6);
    matches = bookmark.labels.some((label) => label.toLowerCase() === wanted);
  } else {
    matches = searchableText(bookmark).includes(lowered);
  }
  return token.excluded ? !matches : matches;
}

function groupTokens(tokens) {
  const groups = [[]];
  for (const token of tokens) {
    if (token.operator) groups.push([]);
    else groups.at(-1).push(token);
  }
  return groups.filter((group) => group.length);
}

export function matchesSearch(bookmark, query, matchMode = 'all', labelStates = new Map()) {
  for (const [label, state] of labelStates) {
    const hasLabel = bookmark.labels.some((item) => item.toLowerCase() === label.toLowerCase());
    if ((state === 'include' && !hasLabel) || (state === 'exclude' && hasLabel)) return false;
  }
  const { tokens } = tokenizeQuery(query.trim());
  if (!tokens.length) return true;
  const positivePlain = tokens.filter((token) => !token.operator && !token.excluded && !token.value.toLowerCase().startsWith('label:'));
  const conditions = tokens.filter((token) => !token.operator);
  if (matchMode === 'phrase' && positivePlain.length) {
    const phrase = positivePlain.map((token) => token.value).join(' ').toLowerCase();
    if (!searchableText(bookmark).includes(phrase)) return false;
    return conditions.filter((token) => token.excluded || token.value.toLowerCase().startsWith('label:')).every((token) => tokenMatches(bookmark, token));
  }
  if (matchMode === 'any' && positivePlain.length) {
    const anyPositive = positivePlain.some((token) => tokenMatches(bookmark, token));
    const required = conditions.filter((token) => token.excluded || token.value.toLowerCase().startsWith('label:'));
    return anyPositive && required.every((token) => tokenMatches(bookmark, token));
  }
  return groupTokens(tokens).some((group) => group.every((token) => tokenMatches(bookmark, token)));
}
