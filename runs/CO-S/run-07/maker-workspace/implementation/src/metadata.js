function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function stripMarkup(value) {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function readAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
}

function parseMetadata(html) {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  let description = '';
  let openGraphTitle = '';
  for (const tag of metas) {
    const key = (readAttribute(tag, 'name') || readAttribute(tag, 'property')).toLowerCase();
    const content = readAttribute(tag, 'content');
    if (!description && ['description', 'og:description', 'twitter:description'].includes(key)) description = content;
    if (!openGraphTitle && ['og:title', 'twitter:title'].includes(key)) openGraphTitle = content;
  }
  return {
    title: stripMarkup(titleMatch ? titleMatch[1] : openGraphTitle),
    description: stripMarkup(description),
  };
}

async function fetchMetadata(address, { fetchImpl = globalThis.fetch, timeoutMs = 7000 } = {}) {
  let url;
  try {
    url = new URL(address);
  } catch {
    const error = new Error('Enter a full web address beginning with http:// or https://');
    error.code = 'INVALID_URL';
    throw error;
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    const error = new Error('Enter a full web address beginning with http:// or https://');
    error.code = 'INVALID_URL';
    throw error;
  }

  try {
    const response = await fetchImpl(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'Pocketmark/1.0 (personal bookmark metadata fetcher)' },
    });
    if (!response.ok) throw new Error(`Page returned ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/html')) throw new Error('Page is not HTML');
    const html = (await response.text()).slice(0, 1_000_000);
    const metadata = parseMetadata(html);
    if (!metadata.title) throw new Error('Page has no readable title');
    return metadata;
  } catch (cause) {
    const error = new Error('We could not fill in this page’s details.');
    error.code = 'DETAILS_UNAVAILABLE';
    error.cause = cause;
    throw error;
  }
}

module.exports = { fetchMetadata, parseMetadata, decodeEntities };
