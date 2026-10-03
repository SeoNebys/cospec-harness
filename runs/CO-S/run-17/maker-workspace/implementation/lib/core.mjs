import net from 'node:net';

export function parseWebAddress(value) {
  const raw = String(value ?? '').trim();
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
  parsed.hash = '';
  return parsed;
}

export function canonicalAddress(value) {
  const parsed = parseWebAddress(value);
  if (!parsed) return null;
  parsed.hostname = parsed.hostname.toLowerCase();
  if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) parsed.port = '';
  if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString();
}

export function displayDomain(value) {
  const parsed = parseWebAddress(value);
  return parsed ? parsed.hostname.replace(/^www\./i, '') : '';
}

export function normalizeNewTag(value) {
  const clean = String(value ?? '').trim().replace(/\s+/g, ' ');
  return clean ? clean[0].toLocaleUpperCase() + clean.slice(1) : '';
}

export function canonicalizeTags(values, existingTags = []) {
  const known = new Map(existingTags.map(tag => [tag.toLocaleLowerCase(), tag]));
  const output = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeNewTag(value);
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(known.get(key) ?? normalized);
  }
  return output;
}

export function tagSummary(bookmarks) {
  const counts = new Map();
  for (const bookmark of bookmarks) {
    for (const tag of bookmark.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function matchesQuery(bookmark, query) {
  const needle = String(query ?? '').trim().toLocaleLowerCase();
  if (!needle) return true;
  return [bookmark.title, bookmark.description, bookmark.note]
    .some(value => String(value ?? '').toLocaleLowerCase().includes(needle));
}

export function noteOnlyMatch(bookmark, query) {
  const needle = String(query ?? '').trim().toLocaleLowerCase();
  if (!needle) return false;
  const visible = `${bookmark.title ?? ''} ${bookmark.description ?? ''}`.toLocaleLowerCase();
  return !visible.includes(needle) && String(bookmark.note ?? '').toLocaleLowerCase().includes(needle);
}

export function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const radix = entity[1].toLowerCase() === 'x' ? 16 : 10;
      const digits = radix === 16 ? entity.slice(2) : entity.slice(1);
      const code = Number.parseInt(digits, radix);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    }
    return named[entity.toLowerCase()] ?? _;
  });
}

function cleanText(value) {
  return decodeEntities(String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

export function extractPageDetails(html, address) {
  const source = String(html ?? '');
  const metas = [...source.matchAll(/<meta\b[^>]*>/gi)].map(match => attributes(match[0]));
  const findMeta = (...names) => {
    const wanted = names.map(name => name.toLowerCase());
    const found = metas.find(meta => wanted.includes((meta.property ?? meta.name ?? '').toLowerCase()));
    return cleanText(found?.content ?? '');
  };
  const titleMatch = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = findMeta('og:title', 'twitter:title') || cleanText(titleMatch?.[1] ?? '');
  const paragraph = source.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  const description = findMeta('description', 'og:description', 'twitter:description') || cleanText(paragraph?.[1] ?? '') || `A page saved from ${displayDomain(address)}.`;
  return { title, description, domain: displayDomain(address) };
}

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}

export function isPrivateHost(hostname) {
  const host = String(hostname ?? '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return true;
  const family = net.isIP(host);
  if (family === 4) return isPrivateIpv4(host);
  if (family === 6) return host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb');
  return false;
}
