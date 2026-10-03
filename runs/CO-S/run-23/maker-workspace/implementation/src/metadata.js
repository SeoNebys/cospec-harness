function decodeEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function cleanText(value) {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function readMeta(html, names) {
  const tags = html.match(/<meta\s+[^>]*>/gi) || [];
  for (const tag of tags) {
    const attrs = {};
    for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
    }
    const identity = (attrs.property || attrs.name || '').toLowerCase();
    if (names.includes(identity) && attrs.content) return cleanText(attrs.content);
  }
  return '';
}

function extractMetadata(html, address) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = readMeta(html, ['og:title', 'twitter:title']) || (titleMatch ? cleanText(titleMatch[1]) : '');
  const description = readMeta(html, ['description', 'og:description', 'twitter:description']);
  const source = new URL(address).hostname.replace(/^www\./i, '');
  return { title, description, source };
}

async function fetchPageMetadata(address, fetchImpl = globalThis.fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetchImpl(address, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'accept': 'text/html,application/xhtml+xml',
        'user-agent': 'Trove Bookmark Manager/1.0'
      }
    });
    if (!response.ok) throw new Error(`Page returned ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('html')) throw new Error('Page is not HTML');
    const html = (await response.text()).slice(0, 1_500_000);
    return extractMetadata(html, response.url || address);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { extractMetadata, fetchPageMetadata };
