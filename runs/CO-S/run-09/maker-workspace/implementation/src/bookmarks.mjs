import { randomUUID } from 'node:crypto';

const REFERRAL_PARAMS = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid', 'igshid',
  'ref', 'referrer', 'campaign', 'campaign_id'
]);

export function parseWebUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value ?? '').trim());
  } catch {
    throw new Error('Paste a complete web address beginning with http:// or https://.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Paste a complete web address beginning with http:// or https://.');
  }
  return parsed;
}

export function canonicalizeUrl(value) {
  const url = parseWebUrl(value);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || REFERRAL_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

export function sourceFromUrl(value) {
  return parseWebUrl(value).hostname.replace(/^www\./i, '');
}

export function normalizeTags(tags = [], knownTags = []) {
  const spelling = new Map(knownTags.map(tag => [String(tag).trim().toLocaleLowerCase(), String(tag).trim()]));
  const result = [];
  const seen = new Set();
  for (const raw of tags) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(spelling.get(key) ?? trimmed.toLocaleLowerCase());
  }
  return result;
}

function decodeEntities(value) {
  const entities = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…'
  };
  return String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match);
}

function cleanText(value) {
  return decodeEntities(String(value ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '');
}

function metaContent(html, key) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const property = attribute(tag, 'property') || attribute(tag, 'name');
    if (property.toLowerCase() === key.toLowerCase()) return attribute(tag, 'content');
  }
  return '';
}

function linkHref(html, relName) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const rel = attribute(tag, 'rel').toLowerCase().split(/\s+/);
    if (rel.includes(relName)) return attribute(tag, 'href');
  }
  return '';
}

function absoluteUrl(value, base) {
  if (!value) return '';
  try { return new URL(value, base).toString(); } catch { return ''; }
}

function readableParagraphs(html) {
  const withoutNoise = html
    .replace(/<(script|style|noscript|svg|canvas|form|nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ');
  const article = withoutNoise.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    ?? withoutNoise.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    ?? withoutNoise.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    ?? withoutNoise;
  const blocks = [];
  for (const match of article.matchAll(/<(h[1-6]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = cleanText(match[2]);
    if (text.length >= 20 && !blocks.includes(text)) blocks.push(text);
    if (blocks.length >= 120) break;
  }
  if (blocks.length) return blocks;
  const fallback = cleanText(article);
  return fallback ? [fallback.slice(0, 30_000)] : [];
}

export function extractPage(html, address) {
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '';
  const title = cleanText(metaContent(html, 'og:title') || metaContent(html, 'twitter:title') || titleTag || h1 || sourceFromUrl(address));
  const description = cleanText(metaContent(html, 'og:description') || metaContent(html, 'description') || metaContent(html, 'twitter:description'));
  const preview = absoluteUrl(metaContent(html, 'og:image') || metaContent(html, 'twitter:image'), address);
  const icon = absoluteUrl(linkHref(html, 'icon') || '/favicon.ico', address);
  return {
    title,
    description,
    source: sourceFromUrl(address),
    icon,
    preview,
    archive: {
      status: 'ready',
      capturedAt: new Date().toISOString(),
      body: readableParagraphs(html)
    }
  };
}

export async function fetchPage(address, fetchImpl = globalThis.fetch, timeoutMs = 8_000) {
  const url = parseWebUrl(address).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  try {
    const response = await fetchImpl(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'TroveBookmarkLibrary/1.0', accept: 'text/html,application/xhtml+xml' }
    });
    if (!response.ok) throw new Error(`Page returned ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('Page is not readable HTML');
    }
    const html = await response.text();
    return extractPage(html.slice(0, 2_000_000), response.url || url);
  } finally {
    clearTimeout(timeout);
  }
}

export function allKnownTags(bookmarks) {
  return [...new Set(bookmarks.flatMap(item => item.tags ?? []).map(String))].sort((a, b) => a.localeCompare(b));
}

export function createBookmark(input, knownTags = []) {
  const now = new Date().toISOString();
  const url = parseWebUrl(input.url).toString();
  const archive = input.archive?.status === 'ready'
    ? { status: 'ready', capturedAt: input.archive.capturedAt ?? now, body: Array.isArray(input.archive.body) ? input.archive.body.map(String) : [] }
    : { status: 'pending', capturedAt: null, body: [] };
  return {
    id: randomUUID(),
    url,
    canonicalUrl: canonicalizeUrl(url),
    title: String(input.title ?? '').trim() || sourceFromUrl(url),
    description: String(input.description ?? '').trim(),
    source: String(input.source ?? '').trim() || sourceFromUrl(url),
    icon: String(input.icon ?? '').trim(),
    preview: String(input.preview ?? '').trim(),
    note: String(input.note ?? '').trim(),
    tags: normalizeTags(input.tags, knownTags),
    readLater: Boolean(input.readLater),
    archive,
    originalAvailable: input.originalAvailable !== false,
    manualContext: Boolean(input.manualContext),
    createdAt: now,
    updatedAt: now
  };
}

export function updateBookmark(bookmark, changes, knownTags = []) {
  return {
    ...bookmark,
    title: changes.title === undefined ? bookmark.title : String(changes.title).trim() || bookmark.source,
    description: changes.description === undefined ? bookmark.description : String(changes.description).trim(),
    note: changes.note === undefined ? bookmark.note : String(changes.note).trim(),
    tags: changes.tags === undefined ? bookmark.tags : normalizeTags(changes.tags, knownTags),
    updatedAt: new Date().toISOString()
  };
}

export function matchesSearch(bookmark, query) {
  const needle = String(query ?? '').trim().toLocaleLowerCase();
  if (!needle) return true;
  return [bookmark.title, bookmark.description, bookmark.note]
    .some(value => String(value ?? '').toLocaleLowerCase().includes(needle));
}

export function applyCapturedPage(bookmark, captured) {
  return {
    ...bookmark,
    source: bookmark.source || captured.source,
    icon: bookmark.icon || captured.icon,
    preview: bookmark.preview || captured.preview,
    title: bookmark.manualContext ? bookmark.title : (captured.title || bookmark.title),
    description: bookmark.manualContext ? bookmark.description : (captured.description || bookmark.description),
    archive: captured.archive,
    originalAvailable: true,
    updatedAt: new Date().toISOString()
  };
}
