import { lookup } from 'node:dns/promises';
import net from 'node:net';

export function validateWebAddress(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw ?? '').trim());
  } catch {
    throw new Error('Enter a complete web address, such as https://example.com/article');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Enter a complete web address beginning with http:// or https://');
  }
  return parsed.toString();
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

async function assertPublicDestination(url, lookupImpl) {
  const parsed = new URL(url);
  if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.localhost')) throw new Error('Local addresses cannot be collected');
  if (net.isIP(parsed.hostname)) {
    if (isPrivateAddress(parsed.hostname)) throw new Error('Private addresses cannot be collected');
    return;
  }
  const records = await lookupImpl(parsed.hostname, { all: true, verbatim: true });
  if (!records.length || records.some(record => isPrivateAddress(record.address))) throw new Error('The page address is not publicly reachable');
}

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

function cleanText(value = '') {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function metaContent(html, keys) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = {};
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
    }
    const identity = (attributes.property || attributes.name || '').toLowerCase();
    if (keys.includes(identity) && attributes.content) return cleanText(attributes.content);
  }
  return '';
}

async function readLimitedBody(response, maxBytes = 1_000_000) {
  if (!response.body?.getReader) return (await response.text()).slice(0, maxBytes);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = maxBytes - size;
    const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
    size += chunk.byteLength;
    text += decoder.decode(chunk, { stream: true });
    if (value.byteLength > remaining) break;
  }
  text += decoder.decode();
  await reader.cancel().catch(() => {});
  return text;
}

export async function fetchPageDetails(address, { fetchImpl = fetch, lookupImpl = lookup } = {}) {
  let current = validateWebAddress(address);
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    await assertPublicDestination(current, lookupImpl);
    const response = await fetchImpl(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(7000),
      headers: { 'user-agent': 'NestBookmarks/1.0 (+personal bookmark metadata)' }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('The page redirected without a destination');
      current = validateWebAddress(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`The page returned ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/html')) throw new Error('The address is not an HTML page');
    const html = await readLimitedBody(response);
    const title = metaContent(html, ['og:title', 'twitter:title']) || cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
    const description = metaContent(html, ['description', 'og:description', 'twitter:description']);
    if (!title) throw new Error('The page did not provide a title');
    return { title, description, site: new URL(current).hostname.replace(/^www\./, '') };
  }
  throw new Error('The page redirected too many times');
}

export function fallbackDetails(address) {
  const url = new URL(address);
  const path = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, '');
  return {
    title: path ? `${url.hostname}/${path}` : url.hostname,
    description: 'We couldn’t load this page’s title or description. The link is still saved.',
    site: url.hostname.replace(/^www\./, '')
  };
}
