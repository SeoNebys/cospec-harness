const TRACKING_KEYS = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid',
  'igshid', 'vero_id', '_hsenc', '_hsmi'
]);

export function parseWebAddress(value) {
  let parsed;
  try { parsed = new URL(String(value).trim()); } catch { return null; }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
  return parsed;
}

export function canonicalAddress(value) {
  const parsed = parseWebAddress(value);
  if (!parsed) return null;
  parsed.hash = '';
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_KEYS.has(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.hostname = parsed.hostname.toLowerCase();
  if ((parsed.protocol === 'https:' && parsed.port === '443') ||
      (parsed.protocol === 'http:' && parsed.port === '80')) parsed.port = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  parsed.searchParams.sort();
  return parsed.toString();
}

export function normalizeTags(values = []) {
  return [...new Set(values.map(value => String(value).trim().toLowerCase()).filter(Boolean))];
}

export function searchableText(bookmark) {
  return [bookmark.title, bookmark.description, bookmark.url, bookmark.note, ...(bookmark.tags || [])]
    .filter(Boolean).join(' ').toLowerCase();
}

export function sectionIncludes(bookmark, section) {
  if (section === 'archive') return Boolean(bookmark.archivedAt);
  if (bookmark.archivedAt) return false;
  if (section === 'read-later') return Boolean(bookmark.readLater);
  return true;
}

export function decodeEntities(value = '') {
  return value
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

export function extractMetadata(html, address) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaTags = [...html.matchAll(/<meta\s+[^>]*>/gi)].map(match => match[0]);
  let description = '';
  for (const tag of metaTags) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
      .map(match => [match[1].toLowerCase(), match[2]]));
    if (attrs.name?.toLowerCase() === 'description' || attrs.property?.toLowerCase() === 'og:description') {
      description = attrs.content || '';
      if (description) break;
    }
  }
  const title = decodeEntities(titleMatch?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || '');
  return {
    title: title || address,
    description: decodeEntities(description.replace(/\s+/g, ' ').trim()),
    metadataStatus: title || description ? 'complete' : 'unavailable'
  };
}
