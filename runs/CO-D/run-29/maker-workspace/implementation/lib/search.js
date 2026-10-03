export function searchBookmarks(bookmarks, input) {
  const query = String(input ?? '').trim();
  if (!query) return { status: 'ok', results: bookmarks.map(withoutMatchExcerpt) };

  try {
    const explicit = hasExplicitOperators(query);
    return explicit
      ? searchExplicit(bookmarks, query)
      : searchCompact(bookmarks, query);
  } catch (error) {
    if (error instanceof IncompleteSearchError) {
      return { status: 'incomplete', message: 'Finish the combination to see results', results: [] };
    }
    throw error;
  }
}

function searchCompact(bookmarks, query) {
  const phrases = [...query.matchAll(/"([^"]*)"/g)].map(match => match[1].trim()).filter(Boolean);
  if ((query.match(/"/g)?.length ?? 0) % 2 !== 0) throw new IncompleteSearchError();
  const tags = [...query.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map(match => match[1].toLocaleLowerCase());
  const terms = query
    .replace(/"[^"]*"/g, ' ')
    .replace(/#[\p{L}\p{N}_-]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    status: 'ok',
    results: bookmarks.flatMap(bookmark => {
      const fullText = searchableText(bookmark, true);
      const visibleText = searchableText(bookmark, false);
      const wordsMatch = terms.every(term => fullText.includes(term.toLocaleLowerCase()));
      const phrasesMatch = phrases.every(phrase => fullText.includes(phrase.toLocaleLowerCase()));
      const bookmarkTags = bookmark.tags.map(tag => tag.toLocaleLowerCase());
      const tagsMatch = tags.length === 0 || tags.some(tag => bookmarkTags.includes(tag));
      if (!wordsMatch || !phrasesMatch || !tagsMatch) return [];
      const visibleWordsMatch = terms.every(term => visibleText.includes(term.toLocaleLowerCase()));
      const visiblePhrasesMatch = phrases.every(phrase => visibleText.includes(phrase.toLocaleLowerCase()));
      return [{ ...bookmark, matchExcerpt: (!visibleWordsMatch || !visiblePhrasesMatch) ? noteExcerpt(bookmark.notes) : null }];
    })
  };
}

function searchExplicit(bookmarks, query) {
  const tree = parseExpression(tokenize(query));
  return {
    status: 'ok',
    results: bookmarks.flatMap(bookmark => {
      if (!evaluate(tree, bookmark, true)) return [];
      const noteOnly = !evaluate(tree, bookmark, false);
      return [{ ...bookmark, matchExcerpt: noteOnly ? noteExcerpt(bookmark.notes) : null }];
    })
  };
}

function tokenize(query) {
  const tokens = [];
  const matcher = /"([^"]*)"|#[\p{L}\p{N}_-]+|[()]|[^\s()]+/gu;
  let quoteCount = 0;
  for (const char of query) if (char === '"') quoteCount += 1;
  if (quoteCount % 2 !== 0) throw new IncompleteSearchError();

  for (const match of query.matchAll(matcher)) {
    const raw = match[0];
    if (raw.startsWith('"')) tokens.push({ type: 'ATOM', kind: 'phrase', value: match[1].toLocaleLowerCase() });
    else if (raw.startsWith('#')) tokens.push({ type: 'ATOM', kind: 'tag', value: raw.slice(1).toLocaleLowerCase() });
    else if (raw === '(') tokens.push({ type: 'LPAREN' });
    else if (raw === ')') tokens.push({ type: 'RPAREN' });
    else if (['AND', 'OR', 'NOT'].includes(raw.toUpperCase())) tokens.push({ type: raw.toUpperCase() });
    else tokens.push({ type: 'ATOM', kind: 'word', value: raw.toLocaleLowerCase() });
  }
  return tokens;
}

function parseExpression(tokens) {
  if (tokens.length === 0) return null;
  let index = 0;
  const peek = () => tokens[index];
  const take = type => peek()?.type === type ? tokens[index++] : null;
  const startsOperand = token => token && ['ATOM', 'LPAREN', 'NOT'].includes(token.type);

  function primary() {
    if (take('LPAREN')) {
      if (!peek()) throw new IncompleteSearchError();
      const node = orExpression();
      if (!take('RPAREN')) throw new IncompleteSearchError();
      return node;
    }
    const atom = take('ATOM');
    if (!atom) throw new IncompleteSearchError();
    return atom;
  }

  function unary() {
    if (take('NOT')) return { type: 'NOT', child: unary() };
    return primary();
  }

  function andExpression() {
    let node = unary();
    while (true) {
      if (take('AND')) node = { type: 'AND', left: node, right: unary() };
      else if (startsOperand(peek())) node = { type: 'AND', left: node, right: unary() };
      else break;
    }
    return node;
  }

  function orExpression() {
    let node = andExpression();
    while (take('OR')) node = { type: 'OR', left: node, right: andExpression() };
    return node;
  }

  const tree = orExpression();
  if (index !== tokens.length) throw new IncompleteSearchError();
  return tree;
}

function evaluate(node, bookmark, includeNotes) {
  if (!node) return true;
  if (node.type === 'AND') return evaluate(node.left, bookmark, includeNotes) && evaluate(node.right, bookmark, includeNotes);
  if (node.type === 'OR') return evaluate(node.left, bookmark, includeNotes) || evaluate(node.right, bookmark, includeNotes);
  if (node.type === 'NOT') return !evaluate(node.child, bookmark, includeNotes);
  if (node.kind === 'tag') return bookmark.tags.some(tag => tag.toLocaleLowerCase() === node.value);
  return searchableText(bookmark, includeNotes).includes(node.value);
}

function hasExplicitOperators(query) {
  const withoutQuotes = query.replace(/"[^"]*"/g, '');
  return /(^|\s|\()(AND|OR|NOT)(?=\s|\)|$)/i.test(withoutQuotes) || /[()]/.test(withoutQuotes);
}

function searchableText(bookmark, includeNotes) {
  return [bookmark.title, bookmark.description, bookmark.address, includeNotes ? bookmark.notes : '']
    .join('\n').toLocaleLowerCase();
}

function noteExcerpt(notes) {
  const plain = String(notes ?? '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 180 ? `${plain.slice(0, 177)}…` : plain;
}

function withoutMatchExcerpt(bookmark) {
  return { ...bookmark, matchExcerpt: null };
}

class IncompleteSearchError extends Error {}
