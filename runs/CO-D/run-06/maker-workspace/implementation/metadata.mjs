import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { parseWebAddress } from './store.mjs';

function decodeEntities(value = '') {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

function attributeValue(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(pattern);
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? '') : '';
}

export function parsePageMetadata(html, pageUrl) {
  const tags = String(html).match(/<(?:meta|link)\b[^>]*>/gi) ?? [];
  let title = '';
  let description = '';
  let iconHref = '';

  for (const tag of tags) {
    const property = (attributeValue(tag, 'property') || attributeValue(tag, 'name')).toLowerCase();
    const content = attributeValue(tag, 'content');
    const rel = attributeValue(tag, 'rel').toLowerCase();
    if (!title && property === 'og:title') title = content;
    if (!description && ['description', 'og:description'].includes(property)) description = content;
    if (!iconHref && rel.split(/\s+/).includes('icon')) iconHref = attributeValue(tag, 'href');
  }

  if (!title) {
    const titleMatch = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) title = decodeEntities(titleMatch[1].replace(/<[^>]+>/g, ''));
  }

  const parsed = parseWebAddress(pageUrl);
  let iconUrl = '';
  if (iconHref) {
    const resolvedIcon = new URL(iconHref, parsed);
    if (['http:', 'https:'].includes(resolvedIcon.protocol)) iconUrl = resolvedIcon.href;
  }
  return {
    title: title || parsed.hostname.replace(/^www\./, ''),
    description,
    iconUrl,
    iconText: (title || parsed.hostname.replace(/^www\./, '')).charAt(0).toUpperCase()
  };
}

function isPrivateAddress(address) {
  if (address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:')) return true;
  if (!address.includes('.')) return false;
  const parts = address.split('.').map(Number);
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] === 0;
}

async function assertPublicAddress(url) {
  const parsed = parseWebAddress(url);
  if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local')) throw new Error('Private addresses cannot be retrieved');
  if (isIP(parsed.hostname)) {
    if (isPrivateAddress(parsed.hostname)) throw new Error('Private addresses cannot be retrieved');
    return;
  }
  const addresses = await lookup(parsed.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Private addresses cannot be retrieved');
  }
}

async function fetchWithSafeRedirects(url) {
  let current = parseWebAddress(url).href;
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    await assertPublicAddress(current);
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
      headers: { 'user-agent': 'TuckBookmarkBot/1.0', accept: 'text/html,application/xhtml+xml' }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Page redirect was incomplete');
      current = new URL(location, current).href;
      continue;
    }
    if (!response.ok) throw new Error(`Page responded with ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('Page details are not available');
    }
    return { response, finalUrl: current };
  }
  throw new Error('Too many page redirects');
}

export async function retrievePageMetadata(url) {
  const { response, finalUrl } = await fetchWithSafeRedirects(url);
  const html = (await response.text()).slice(0, 1_500_000);
  return parsePageMetadata(html, finalUrl);
}
