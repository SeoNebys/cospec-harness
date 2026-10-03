import { createHash, randomUUID } from 'node:crypto';

export const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid',
  'ref_src', 'ref_url', 'igshid', 'vero_conv', 'vero_id'
]);

export function parseWebAddress(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { ok: false, error: 'Paste a web address to continue.' };
  let url;
  try { url = new URL(raw); } catch {
    return { ok: false, error: 'This doesn’t look like a complete web address. Try one beginning with http:// or https://.' };
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, error: 'Only web addresses beginning with http:// or https:// can be saved.' };
  }
  return { ok: true, url };
}

export function isTrackingParam(name) {
  const lower = name.toLowerCase();
  return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower);
}

export function normalizeUrl(value) {
  const parsed = parseWebAddress(value);
  if (!parsed.ok) throw new Error(parsed.error);
  const url = new URL(parsed.url.href);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (isTrackingParam(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  url.searchParams.sort();
  return url.href.replace(/\?$/, '').toLowerCase();
}

export function normalizeTag(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function uniqueTags(values) {
  return [...new Set((values ?? []).map(normalizeTag).filter(Boolean))];
}

function lex(query) {
  const tokens = [];
  let index = 0;
  while (index < query.length) {
    if (/\s/.test(query[index])) { index += 1; continue; }
    const char = query[index];
    if (char === '(' || char === ')') { tokens.push({ type: char }); index += 1; continue; }
    if (char === '"') {
      const start = ++index;
      while (index < query.length && query[index] !== '"') index += 1;
      if (index >= query.length) throw new SearchSyntaxError('Close the quoted phrase with another quotation mark.');
      const value = query.slice(start, index);
      index += 1;
      if (!value.trim()) throw new SearchSyntaxError('Put some words inside the quotation marks.');
      tokens.push({ type: 'TERM', kind: 'phrase', value });
      continue;
    }
    const start = index;
    while (index < query.length && !/[\s()]/.test(query[index])) index += 1;
    const word = query.slice(start, index);
    const upper = word.toUpperCase();
    if (['AND', 'OR', 'NOT'].includes(upper)) tokens.push({ type: upper });
    else if (/^tag:/i.test(word)) {
      const value = normalizeTag(word.slice(4));
      if (!value) throw new SearchSyntaxError('Add a tag name after “tag:”.');
      tokens.push({ type: 'TERM', kind: 'tag', value });
    } else tokens.push({ type: 'TERM', kind: 'text', value: word });
  }
  return tokens;
}

export class SearchSyntaxError extends Error {
  constructor(message) { super(message); this.name = 'SearchSyntaxError'; }
}

export function parseSearch(query) {
  const source = String(query ?? '').trim();
  if (!source) return { ast: null, interpretation: [] };
  const tokens = lex(source);
  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];
  const startsOperand = token => token && (token.type === 'TERM' || token.type === '(' || token.type === 'NOT');

  function primary() {
    const token = take();
    if (!token) throw new SearchSyntaxError('Add another word or condition to finish this search.');
    if (token.type === 'TERM') return { type: token.kind, value: token.value };
    if (token.type === '(') {
      if (peek()?.type === ')') throw new SearchSyntaxError('Put a search condition inside the parentheses.');
      const node = or();
      if (peek()?.type !== ')') throw new SearchSyntaxError('Close the unfinished group with a parenthesis.');
      take();
      return { type: 'group', child: node };
    }
    throw new SearchSyntaxError('Add a word, quoted phrase, tag, or grouped condition here.');
  }
  function unary() {
    if (peek()?.type === 'NOT') { take(); return { type: 'not', child: unary() }; }
    return primary();
  }
  function and() {
    let node = unary();
    while (peek()?.type === 'AND' || startsOperand(peek())) {
      if (peek()?.type === 'AND') {
        take();
        if (!startsOperand(peek())) throw new SearchSyntaxError('After “AND,” add another word or condition.');
      }
      node = { type: 'and', left: node, right: unary() };
    }
    return node;
  }
  function or() {
    let node = and();
    while (peek()?.type === 'OR') {
      take();
      if (!startsOperand(peek())) throw new SearchSyntaxError('After “OR,” add another condition and close any unfinished parenthesis.');
      node = { type: 'or', left: node, right: and() };
    }
    return node;
  }

  const ast = or();
  if (cursor < tokens.length) {
    if (peek()?.type === ')') throw new SearchSyntaxError('Remove the unmatched closing parenthesis.');
    throw new SearchSyntaxError('This search has an unfinished condition.');
  }
  return { ast, interpretation: describeSearch(ast) };
}

function searchableText(bookmark) {
  return [bookmark.title, bookmark.description, bookmark.notes, bookmark.url].join('\n').toLowerCase();
}

export function matchesSearch(ast, bookmark) {
  if (!ast) return true;
  switch (ast.type) {
    case 'text': return searchableText(bookmark).includes(ast.value.toLowerCase());
    case 'phrase': return searchableText(bookmark).includes(ast.value.toLowerCase());
    case 'tag': return (bookmark.tags ?? []).some(tag => tag.toLowerCase() === ast.value.toLowerCase());
    case 'not': return !matchesSearch(ast.child, bookmark);
    case 'and': return matchesSearch(ast.left, bookmark) && matchesSearch(ast.right, bookmark);
    case 'or': return matchesSearch(ast.left, bookmark) || matchesSearch(ast.right, bookmark);
    case 'group': return matchesSearch(ast.child, bookmark);
    default: return false;
  }
}

export function describeSearch(ast) {
  if (!ast) return [];
  function text(node) {
    switch (node.type) {
      case 'text': return `text contains “${node.value}”`;
      case 'phrase': return `exact phrase “${node.value}”`;
      case 'tag': return `tag exactly “${node.value}”`;
      case 'not': return `exclude ${text(node.child)}`;
      case 'and': return `${text(node.left)} AND ${text(node.right)}`;
      case 'or': return `${text(node.left)} OR ${text(node.right)}`;
      case 'group': return `(${text(node.child)})`;
      default: return '';
    }
  }
  return [text(ast)];
}

export function searchBookmarks(bookmarks, query) {
  const parsed = parseSearch(query);
  return { ...parsed, bookmarks: bookmarks.filter(bookmark => matchesSearch(parsed.ast, bookmark)) };
}

const decodeEntities = value => String(value ?? '')
  .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

function findMeta(html, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i')
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return decodeEntities(match[1].trim());
    }
  }
  return '';
}

function stripMarkup(html) {
  return decodeEntities(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')).trim();
}

export function extractPage(html, address) {
  const url = new URL(address);
  const title = findMeta(html, ['og:title', 'twitter:title']) || decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '') || url.hostname;
  const description = findMeta(html, ['description', 'og:description', 'twitter:description']);
  const image = findMeta(html, ['og:image', 'twitter:image']);
  const author = findMeta(html, ['author', 'article:author']);
  const publishedAt = findMeta(html, ['article:published_time', 'date', 'datePublished']);
  const faviconMatch = html.match(/<link[^>]+rel=["'][^"']*(?:icon|shortcut icon)[^"']*["'][^>]+href=["']([^"']+)["']/i);
  const icon = faviconMatch ? new URL(faviconMatch[1], url).href : `${url.origin}/favicon.ico`;
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) || html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const bodyText = stripMarkup(articleMatch?.[1] ?? html).slice(0, 50_000);
  const paragraphs = bodyText.match(/.{1,900}(?:\s|$)/g)?.map(part => part.trim()).filter(Boolean).slice(0, 24) ?? [];
  return {
    title: title.slice(0, 500), description: description.slice(0, 2_000), icon, image,
    archive: {
      title: title.slice(0, 500), description: description.slice(0, 2_000), author, publishedAt,
      source: url.hostname, originalUrl: address, capturedAt: new Date().toISOString(), image,
      paragraphs: paragraphs.length ? paragraphs : [description || title]
    }
  };
}

export const DEMO_PAGES = {
  rome: {
    title: 'A local’s walking guide to Rome',
    description: 'Quiet streets, timeless landmarks, and neighborhood stops for exploring Rome on foot.',
    author: 'Lucia Ferri', publishedAt: '2026-09-14', image: '',
    paragraphs: [
      'Begin before the streets fill, when shutters are lifting and the first coffee cups reach the counters. Rome rewards a slow route more than a strict itinerary.',
      'Cross the river by the oldest bridge you can find, then leave the main road whenever a shaded lane catches your eye.'
    ]
  },
  water: {
    title: 'How ancient cities managed water',
    description: 'An illustrated history of aqueducts, fountains, and daily life in Rome.',
    author: 'Mara Cole', publishedAt: '2026-08-21', image: '',
    paragraphs: ['Water shaped the ancient city one channel at a time.', 'Public fountains made engineering part of daily civic life.']
  },
  trees: {
    title: 'Why old city trees outlive the streets around them',
    description: 'A field report on roots, stonework, and the people caring for ancient urban trees.',
    author: 'Elena Marin', publishedAt: '2026-09-08', image: '',
    paragraphs: ['At the center of the oldest square, the paving bends around a plane tree whose roots began spreading before the surrounding streets carried cars.', 'Preserving these trees means preserving a living record.']
  }
};

export function demoPageFor(address) {
  try {
    const url = new URL(address);
    const match = url.pathname.match(/\/demo\/original\/(rome|water|trees)$/);
    if (!match) return null;
    const page = DEMO_PAGES[match[1]];
    return {
      title: page.title, description: page.description, icon: '', image: page.image,
      archive: { ...page, source: url.host, originalUrl: address, capturedAt: new Date().toISOString() }
    };
  } catch { return null; }
}

export function makeBookmark({ url, details, title, description, notes, tags, readLater = false, captureStatus = 'ready' }) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(), url, normalizedUrl: normalizeUrl(url),
    title: String(title || details?.title || new URL(url).hostname).trim(),
    description: String(description ?? details?.description ?? '').trim(), notes: String(notes ?? '').trim(),
    tags: uniqueTags(tags), favicon: details?.icon || '', image: details?.image || '', readLater: Boolean(readLater),
    titleEdited: Boolean(String(title ?? '').trim()), descriptionEdited: Boolean(String(description ?? '').trim()),
    capture: captureStatus === 'ready' ? { status: 'ready', ...details?.archive } : { status: 'pending', attempts: 0, lastAttemptAt: now },
    originalAvailable: true, createdAt: now, updatedAt: now
  };
}

export function applyRecoveredDetails(bookmark, details) {
  if (!bookmark.titleEdited) bookmark.title = details.title;
  if (!bookmark.descriptionEdited) bookmark.description = details.description;
  bookmark.favicon = details.icon || '';
  bookmark.image = details.image || '';
  bookmark.capture = { status: 'ready', ...details.archive };
  bookmark.originalAvailable = true;
  bookmark.updatedAt = new Date().toISOString();
  return bookmark;
}

export function publicBookmark(bookmark) {
  const { capture, ...rest } = bookmark;
  return { ...rest, capture: capture ? {
    status: capture.status, capturedAt: capture.capturedAt, source: capture.source,
    author: capture.author, publishedAt: capture.publishedAt
  } : { status: 'pending' } };
}

export function contentFingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
