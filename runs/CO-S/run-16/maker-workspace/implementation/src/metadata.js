import dns from 'node:dns/promises';
import net from 'node:net';

function decodeEntities(value = '') {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function textContent(value = '') {
  return decodeEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function metaContent(html, key, attribute = 'property') {
  const patterns = [
    new RegExp(`<meta[^>]+${attribute}=["']${key}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attribute}=["']${key}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeEntities(match[1].trim());
  }
  return '';
}

export function extractMetadata(html, pageUrl) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = metaContent(html, 'og:title') || textContent(titleMatch?.[1] || '');
  const description = metaContent(html, 'description', 'name') || metaContent(html, 'og:description');
  const imageValue = metaContent(html, 'og:image');
  let image = '';
  if (imageValue) {
    try {
      const candidate = new URL(imageValue, pageUrl);
      image = ['http:', 'https:'].includes(candidate.protocol) ? candidate.toString() : '';
    } catch { image = ''; }
  }
  const articleText = textContent(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' '));
  const wordCount = articleText ? articleText.split(/\s+/).length : 0;
  return {
    title: title.slice(0, 500),
    description: description.slice(0, 1000),
    image,
    readingMinutes: Math.max(1, Math.ceil(wordCount / 220))
  };
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
  }
  return true;
}

async function assertPublicHost(url, allowPrivate) {
  if (allowPrivate) return;
  const host = new URL(url).hostname;
  if (host === 'localhost' || host.endsWith('.localhost')) throw new Error('Private addresses are not supported.');
  const addresses = await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some(result => isPrivateIp(result.address))) {
    throw new Error('Private addresses are not supported.');
  }
}

export async function fetchPageMetadata(inputUrl, { allowPrivate = false, fetchImpl = fetch } = {}) {
  let currentUrl = inputUrl;
  for (let redirects = 0; redirects < 4; redirects += 1) {
    await assertPublicHost(currentUrl, allowPrivate);
    const response = await fetchImpl(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(7000),
      headers: { 'user-agent': 'LatticeBookmarkBot/1.0', accept: 'text/html,application/xhtml+xml' }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect did not include a destination.');
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    if (!response.ok) throw new Error(`Page returned ${response.status}.`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('Page is not HTML.');
    }
    const html = (await response.text()).slice(0, 2_000_000);
    const metadata = extractMetadata(html, currentUrl);
    if (!metadata.title) throw new Error('Page did not provide a title.');
    return metadata;
  }
  throw new Error('Too many redirects.');
}
