export class SearchSyntaxError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SearchSyntaxError';
  }
}

function splitGroups(query) {
  const groups = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < query.length; index += 1) {
    const character = query[index];
    if (character === '"') quoted = !quoted;

    if (!quoted && /\s/.test(character)) {
      const remaining = query.slice(index);
      const match = remaining.match(/^\s+OR\s+/i);
      if (match) {
        if (!current.trim()) throw new SearchSyntaxError('Add a search before OR.');
        groups.push(current.trim());
        current = '';
        index += match[0].length - 1;
        continue;
      }
    }
    current += character;
  }

  if (quoted) throw new SearchSyntaxError('Add a closing quotation mark to finish the exact phrase.');
  if (current.trim()) groups.push(current.trim());
  if (!groups.length && query.trim()) throw new SearchSyntaxError('Finish the search expression.');
  return groups;
}

function parseGroup(group) {
  const terms = [];
  const pattern = /(-?)(label:)?(?:"([^"]+)"|(\S+))/gi;
  let match;

  while ((match = pattern.exec(group)) !== null) {
    terms.push({
      excluded: match[1] === '-',
      labelOnly: Boolean(match[2]),
      value: (match[3] || match[4] || '').toLocaleLowerCase()
    });
  }

  if (!terms.length) throw new SearchSyntaxError('Finish the search expression.');
  return terms;
}

export function compileSearch(query) {
  const normalized = String(query ?? '').trim();
  if (!normalized) return () => true;
  const groups = splitGroups(normalized).map(parseGroup);

  return bookmark => {
    const labels = (bookmark.labels || []).map(label => label.toLocaleLowerCase());
    const searchable = [
      bookmark.title,
      bookmark.description,
      bookmark.siteName,
      bookmark.url,
      ...labels
    ].join(' ').toLocaleLowerCase();

    return groups.some(terms => terms.every(term => {
      const found = term.labelOnly
        ? labels.some(label => label === term.value)
        : searchable.includes(term.value);
      return term.excluded ? !found : found;
    }));
  };
}
