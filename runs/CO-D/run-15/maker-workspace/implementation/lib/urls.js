import dns from 'node:dns/promises';
import net from 'node:net';

const TRACKING_KEYS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'ref_src'
]);

export function parseWebUrl(value) {
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    const error = new Error('Enter a full web address, like https://example.com/page.');
    error.code = 'INVALID_URL';
    throw error;
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    const error = new Error('Enter a full web address beginning with http:// or https://.');
    error.code = 'INVALID_URL';
    throw error;
  }
  url.username = '';
  url.password = '';
  return url;
}

export function canonicalizeUrl(value) {
  const url = parseWebUrl(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (lower.startsWith('utm_') || TRACKING_KEYS.has(lower)) url.searchParams.delete(key);
  }
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = '';
  }
  if (url.pathname === '') url.pathname = '/';
  return url.toString();
}

export function sameUnderlyingPage(left, right) {
  return canonicalizeUrl(left) === canonicalizeUrl(right);
}

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
}

function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase();
  return normalized === '::1'
    || normalized === '::'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe8')
    || normalized.startsWith('fe9')
    || normalized.startsWith('fea')
    || normalized.startsWith('feb');
}

export async function assertPublicAddress(url) {
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    const error = new Error('That address cannot be fetched.');
    error.code = 'UNSAFE_ADDRESS';
    throw error;
  }
  const literalFamily = net.isIP(hostname);
  if (literalFamily === 4 && isPrivateIPv4(hostname)) throwUnsafe();
  if (literalFamily === 6 && isPrivateIPv6(hostname)) throwUnsafe();
  if (!literalFamily) {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length) throw new Error('The site could not be found.');
    for (const address of addresses) {
      if ((address.family === 4 && isPrivateIPv4(address.address))
        || (address.family === 6 && isPrivateIPv6(address.address))) throwUnsafe();
    }
  }
}

function throwUnsafe() {
  const error = new Error('That address cannot be fetched.');
  error.code = 'UNSAFE_ADDRESS';
  throw error;
}

export function fallbackTitle(url) {
  const segments = url.pathname.split('/').filter(Boolean);
  const last = segments.at(-1);
  if (!last) return url.hostname.replace(/^www\./, '');
  try {
    return decodeURIComponent(last)
      .replace(/[-_]+/g, ' ')
      .replace(/\.[a-z0-9]{1,6}$/i, '')
      .trim() || url.hostname.replace(/^www\./, '');
  } catch {
    return last;
  }
}
