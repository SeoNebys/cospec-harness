const HTML_ENTITY_MAP = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '
};

function decodeEntities(value = '') {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1].toLowerCase() === 'x';
      const number = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : match;
    }
    return HTML_ENTITY_MAP[entity.toLowerCase()] ?? match;
  }).replace(/\s+/g, ' ').trim();
}

function attributesFromTag(tag) {
  const attributes = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function extractMetadata(html, url) {
  const parsedUrl = new URL(url);
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const meta = {};
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = attributesFromTag(match[0]);
    const key = (attributes.property || attributes.name || '').toLowerCase();
    if (key && attributes.content && !meta[key]) meta[key] = attributes.content;
  }
  const title = decodeEntities(meta['og:title'] || titleMatch?.[1] || '');
  const summary = decodeEntities(meta['og:description'] || meta.description || '');
  const siteName = decodeEntities(meta['og:site_name'] || parsedUrl.hostname.replace(/^www\./, ''));
  return { title, summary, siteName };
}

function fallbackMetadata(url) {
  const parsedUrl = new URL(url);
  const pathLabel = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname.replace(/\/$/, '');
  return {
    title: `${parsedUrl.hostname.replace(/^www\./, '')}${pathLabel}`,
    summary: '',
    siteName: parsedUrl.hostname.replace(/^www\./, ''),
    warning: 'We couldn’t retrieve this page’s title or summary. The bookmark was still saved, and you can add those details yourself.'
  };
}

async function fetchPageMetadata(url, { timeoutMs = 6000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Keep Bookmark Manager/1.0' }
    });
    if (!response.ok) throw new Error(`Page returned ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) throw new Error('Page is not HTML');
    const html = (await response.text()).slice(0, 1_500_000);
    const metadata = extractMetadata(html, url);
    if (!metadata.title && !metadata.summary) throw new Error('Page did not provide details');
    return {
      title: metadata.title || fallbackMetadata(url).title,
      summary: metadata.summary,
      siteName: metadata.siteName
    };
  } catch {
    return fallbackMetadata(url);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeUrl(input) {
  if (typeof input !== 'string') throw new TypeError('A web address is required.');
  let parsed;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new TypeError('Enter a complete web address, like https://example.com/article');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new TypeError('Enter a complete web address, like https://example.com/article');
  }
  return parsed.href;
}

module.exports = { decodeEntities, extractMetadata, fallbackMetadata, fetchPageMetadata, normalizeUrl };
