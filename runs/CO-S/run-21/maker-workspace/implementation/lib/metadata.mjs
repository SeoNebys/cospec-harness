import dns from 'node:dns/promises';
import net from 'node:net';

const entityMap = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
function decode(value = '') {
  return value.replace(/&(#x?[0-9a-f]+|amp|quot|apos|lt|gt);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1].toLowerCase() === 'x';
      return String.fromCodePoint(Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return entityMap[entity.toLowerCase()] ?? _;
  }).replace(/\s+/g, ' ').trim();
}

function meta(html, key) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attrs = Object.fromEntries([...tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [match[1].toLowerCase(), match[2]]));
    if ((attrs.property || attrs.name)?.toLowerCase() === key.toLowerCase()) return decode(attrs.content);
  }
  return '';
}

function absolute(value, base) {
  if (!value) return '';
  try { return new URL(value, base).href; } catch { return ''; }
}

export function parseMetadata(html, address) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const iconMatch = html.match(/<link\b(?=[^>]*rel=["'][^"']*(?:icon)[^"']*["'])[^>]*href=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link\b(?=[^>]*href=["']([^"']+)["'])[^>]*rel=["'][^"']*(?:icon)[^"']*["'][^>]*>/i);
  return {
    title: meta(html, 'og:title') || decode(titleMatch?.[1] ?? ''),
    description: meta(html, 'og:description') || meta(html, 'description'),
    siteName: meta(html, 'og:site_name') || new URL(address).hostname.replace(/^www\./, ''),
    imageUrl: absolute(meta(html, 'og:image'), address),
    iconUrl: absolute(iconMatch?.[1] || '/favicon.ico', address)
  };
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:');
}

export async function assertPublicAddress(address) {
  const parsed = new URL(address);
  const records = await dns.lookup(parsed.hostname, { all: true });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) throw new Error('UNSAFE_ADDRESS');
}

export async function collectMetadata(address, { fetchImpl = fetch, checkAddress = assertPublicAddress } = {}) {
  const url = new URL(address);
  await checkAddress(url.href);
  const response = await fetchImpl(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(6000),
    headers: { 'user-agent': 'KeepwellBookmarkBot/1.0', accept: 'text/html,application/xhtml+xml' }
  });
  if (!response.ok) throw new Error('FETCH_FAILED');
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw new Error('UNSUPPORTED_CONTENT');
  const html = (await response.text()).slice(0, 1_500_000);
  const data = parseMetadata(html, response.url || url.href);
  if (!data.title) throw new Error('MISSING_DETAILS');
  return data;
}
