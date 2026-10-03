'use strict';

function normalizeUrl(input) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only complete HTTP and HTTPS addresses are accepted.');
  url.hash = '';
  const tracking = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i;
  [...url.searchParams.keys()].forEach(key => { if (tracking.test(key)) url.searchParams.delete(key); });
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([key]) => {
    const vals = url.searchParams.getAll(key); url.searchParams.delete(key); vals.forEach(v => url.searchParams.append(key, v));
  });
  return url.toString();
}

function plainText(html = '') {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'").replace(/\s+/g, ' ').trim();
}

function searchable(bookmark) {
  return [bookmark.title, bookmark.description, plainText(bookmark.noteHtml), bookmark.site, bookmark.pageText, ...(bookmark.labels || [])]
    .filter(Boolean).join(' ').toLocaleLowerCase();
}

function tokenize(query) {
  const tokens = []; let i = 0;
  while (i < query.length) {
    if (/\s/.test(query[i])) { i++; continue; }
    if (query[i] === '"') {
      const end = query.indexOf('"', i + 1);
      if (end < 0) throw new Error('There is an unclosed quotation mark. Add the closing quote and try again.');
      tokens.push({ type: 'term', value: query.slice(i + 1, end), quoted: true }); i = end + 1; continue;
    }
    if ('()'.includes(query[i])) { tokens.push({ type: query[i] }); i++; continue; }
    let end = i; while (end < query.length && !/[\s()]/.test(query[end])) end++;
    const value = query.slice(i, end); const upper = value.toUpperCase();
    if (['AND', 'OR', 'NOT'].includes(upper)) tokens.push({ type: upper });
    else if (value.startsWith('#') && value.length > 1) tokens.push({ type: 'label', value: value.slice(1) });
    else tokens.push({ type: 'term', value });
    i = end;
  }
  return tokens;
}

function parsePrecise(tokens) {
  let pos = 0;
  const parsePrimary = () => {
    const token = tokens[pos];
    if (!token) throw new Error('The search ends before its last condition is complete.');
    if (token.type === 'NOT') { pos++; return { type: 'not', child: parsePrimary() }; }
    if (token.type === '(') {
      pos++; const node = parseOr();
      if (!tokens[pos] || tokens[pos].type !== ')') throw new Error('There is an unclosed parenthesis. Add “)” to complete the search.');
      pos++; return node;
    }
    if (token.type === 'term' || token.type === 'label') { pos++; return token; }
    throw new Error(`“${token.type}” needs a search condition before it.`);
  };
  const canStart = t => t && ['term', 'label', '(', 'NOT'].includes(t.type);
  const parseAnd = () => {
    let node = parsePrimary();
    while (pos < tokens.length && (tokens[pos].type === 'AND' || tokens[pos].type === 'NOT' || canStart(tokens[pos]))) {
      if (tokens[pos].type === 'AND') pos++;
      const right = parsePrimary(); node = { type: 'and', left: node, right };
    }
    return node;
  };
  const parseOr = () => {
    let node = parseAnd();
    while (tokens[pos]?.type === 'OR') { pos++; node = { type: 'or', left: node, right: parseAnd() }; }
    return node;
  };
  const tree = parseOr();
  if (pos !== tokens.length) {
    if (tokens[pos].type === ')') throw new Error('There is a closing parenthesis without a matching opening parenthesis.');
    throw new Error('This search expression is incomplete.');
  }
  return tree;
}

function evaluate(node, bookmark) {
  const haystack = searchable(bookmark);
  const labels = (bookmark.labels || []).map(x => x.toLocaleLowerCase());
  if (node.type === 'term') return haystack.includes(node.value.toLocaleLowerCase());
  if (node.type === 'label') return labels.includes(node.value.toLocaleLowerCase());
  if (node.type === 'not') return !evaluate(node.child, bookmark);
  if (node.type === 'and') return evaluate(node.left, bookmark) && evaluate(node.right, bookmark);
  if (node.type === 'or') return evaluate(node.left, bookmark) || evaluate(node.right, bookmark);
  return false;
}

function compileSearch(query) {
  const tokens = tokenize(query.trim());
  if (!tokens.length) return { test: () => true, explanation: '' };
  let depth = 0;
  for (const token of tokens) {
    if (token.type === '(') depth++;
    if (token.type === ')') depth--;
    if (depth < 0) throw new Error('There is a closing parenthesis without a matching opening parenthesis.');
  }
  if (depth > 0) throw new Error('There is an unclosed parenthesis. Add “)” to complete the search.');
  const precise = tokens.some(t => ['AND', 'OR', 'NOT', '(', ')'].includes(t.type));
  if (precise) {
    const tree = parsePrecise(tokens);
    return { test: bookmark => evaluate(tree, bookmark), explanation: explain(tokens) };
  }
  const terms = tokens.filter(t => t.type === 'term');
  const labels = tokens.filter(t => t.type === 'label');
  return {
    test(bookmark) {
      const text = searchable(bookmark); const own = (bookmark.labels || []).map(x => x.toLocaleLowerCase());
      return terms.every(t => text.includes(t.value.toLocaleLowerCase())) && (!labels.length || labels.some(l => own.includes(l.value.toLocaleLowerCase())));
    },
    explanation: labels.length ? `Matches the text and ${labels.map(x => '#' + x.value).join(' or ')}` : terms.some(t => t.quoted) ? 'Matches the exact quoted text' : 'Matches saved bookmark information'
  };
}

function explain(tokens) {
  const excluded = []; const required = []; let negate = false;
  for (const t of tokens) {
    if (t.type === 'NOT') { negate = true; continue; }
    if (t.type === 'label' || t.type === 'term') { (negate ? excluded : required).push((t.type === 'label' ? '#' : '') + t.value); negate = false; }
  }
  let result = required.length ? `Matches ${required.join(', ')}` : 'Matches the search';
  if (excluded.length) result += `; excluding ${excluded.join(', ')}`;
  return result;
}

function sortBookmarks(items, order) {
  return [...items].sort((a, b) => order === 'title' ? a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) : order === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = { normalizeUrl, plainText, searchable, tokenize, compileSearch, sortBookmarks };
