import crypto from 'node:crypto';

const TRACKING_KEYS = new Set(['fbclid', 'gclid', 'dclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src']);

export function parseWebUrl(value) {
  let url;
  try { url = new URL(String(value).trim()); } catch { throw new Error('Enter a complete web address, such as https://example.com/article'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https web addresses can be saved');
  return url;
}

export function normalizeUrl(value) {
  const url = parseWebUrl(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_KEYS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  url.searchParams.sort();
  return url.toString();
}

export function stripHtml(value = '') {
  return value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeEntities(value = '') {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export function extractMetadata(html, finalUrl) {
  const attr = (tag, name) => new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i').exec(html)?.slice(1).find(Boolean);
  const title = attr('meta', 'og:title') || /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '';
  const description = attr('meta', 'og:description') || attr('meta', 'description') || '';
  const image = attr('meta', 'og:image') || '';
  const icon = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i.exec(html)?.[1] || '/favicon.ico';
  const resolve = value => { try { return value ? new URL(value, finalUrl).toString() : ''; } catch { return ''; } };
  return { title: decodeEntities(stripHtml(title)), description: decodeEntities(stripHtml(description)), image: resolve(image), icon: resolve(icon) };
}

export async function fetchPageDetails(value, fetchImpl = fetch) {
  const input = parseWebUrl(value);
  const fallback = { title: input.hostname.replace(/^www\./, ''), description: '', image: '', icon: '', limited: true };
  try {
    const response = await fetchImpl(input, { redirect: 'follow', signal: AbortSignal.timeout(6500), headers: { 'user-agent': 'Keepmark/1.0 bookmark metadata reader', accept: 'text/html,application/xhtml+xml' } });
    if (!response.ok) return fallback;
    const type = response.headers.get('content-type') || '';
    if (!type.includes('html')) return fallback;
    const html = (await response.text()).slice(0, 1_500_000);
    const found = extractMetadata(html, response.url || input.toString());
    return { ...fallback, ...found, title: found.title || fallback.title, limited: !(found.title && (found.description || found.image || found.icon)) };
  } catch { return fallback; }
}

export function newBookmark(url, details, now = new Date()) {
  return {
    id: crypto.randomUUID(), url: parseWebUrl(url).toString(), normalizedUrl: normalizeUrl(url),
    title: details.title, description: details.description || '', icon: details.icon || '', image: details.image || '', limited: Boolean(details.limited),
    note: '', labels: [], readLater: false, titleEdited: false, descriptionEdited: false,
    createdAt: now.toISOString(), updatedAt: now.toISOString()
  };
}

export function normalizeLabel(input, existing = []) {
  const label = String(input).trim().replace(/\s+/g, ' ');
  if (!label) return '';
  return existing.find(item => item.toLowerCase() === label.toLowerCase()) || label;
}

export function markdownToHtml(markdown = '') {
  const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const inline = value => escape(value)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  const lines = String(markdown).split(/\r?\n/); let html = '', list = false;
  for (const line of lines) {
    if (line.startsWith('- ')) { if (!list) { html += '<ul>'; list = true; } html += `<li>${inline(line.slice(2))}</li>`; }
    else { if (list) { html += '</ul>'; list = false; } if (line) html += `<p>${inline(line)}</p>`; }
  }
  if (list) html += '</ul>';
  return html;
}

export function compileSearch(query) {
  const found = []; const source = String(query).trim();
  const quoteCount = (source.match(/"/g) || []).length; let depth = 0, broken = false;
  for (const char of source) { if (char === '(') depth++; if (char === ')') depth--; if (depth < 0) broken = true; }
  if (source && (quoteCount % 2 || depth !== 0 || broken || /\b(and|or|not)\s*$/i.test(source))) return { incomplete: true, test: () => true };
  const matcher = /"([^"]*)"|#[\p{L}\p{N}_-]+|\(|\)|\b(?:and|or|not)\b|[^\s()]+/giu; let match;
  while ((match = matcher.exec(source))) {
    const raw = match[0], lower = raw.toLocaleLowerCase();
    if (raw.startsWith('"')) found.push({ type: 'phrase', value: match[1].toLocaleLowerCase() });
    else if (raw === '(') found.push({ type: 'open' }); else if (raw === ')') found.push({ type: 'close' });
    else if (['and', 'or', 'not'].includes(lower)) found.push({ type: lower });
    else if (raw.startsWith('#')) found.push({ type: 'label', value: raw.slice(1).toLocaleLowerCase() });
    else found.push({ type: 'term', value: lower });
  }
  const tokens = [];
  for (const current of found) {
    const prior = tokens.at(-1); const ends = prior && ['term','phrase','label','close'].includes(prior.type); const starts = ['term','phrase','label','open','not'].includes(current.type);
    if (ends && starts) tokens.push({ type: 'and' }); tokens.push(current);
  }
  let position = 0;
  const textOf = item => [item.title, item.description, item.note, item.url].join(' ').toLocaleLowerCase();
  const primary = () => {
    const token = tokens[position++]; if (!token) return () => true;
    if (token.type === 'open') { const inside = orExpr(); if (tokens[position]?.type === 'close') position++; return inside; }
    if (token.type === 'label') return item => item.labels.some(label => label.toLocaleLowerCase() === token.value);
    if (token.type === 'term') return item => textOf(item).includes(token.value);
    if (token.type === 'phrase') { const escaped = token.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'iu'); return item => pattern.test(textOf(item)); }
    return () => true;
  };
  const unary = () => tokens[position]?.type === 'not' ? (position++, ((right) => item => !right(item))(unary())) : primary();
  const andExpr = () => { let left = unary(); while (tokens[position]?.type === 'and') { position++; const prior = left, right = unary(); left = item => prior(item) && right(item); } return left; };
  const orExpr = () => { let left = andExpr(); while (tokens[position]?.type === 'or') { position++; const prior = left, right = andExpr(); left = item => prior(item) || right(item); } return left; };
  return { incomplete: false, test: orExpr() };
}

export function sortBookmarks(items, order) {
  const copy = [...items];
  if (order === 'oldest') return copy.sort((a,b) => a.createdAt.localeCompare(b.createdAt));
  if (order === 'az') return copy.sort((a,b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  if (order === 'za') return copy.sort((a,b) => b.title.localeCompare(a.title, undefined, { sensitivity: 'base' }));
  return copy.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
