import dns from 'node:dns/promises';
import net from 'node:net';
import * as cheerio from 'cheerio';
import { parseWebUrl, siteNameFromUrl } from './url.js';

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return true;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224;
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase().split('%')[0];
  return normalized === '::' || normalized === '::1' ||
    normalized.startsWith('fc') || normalized.startsWith('fd') ||
    normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
    normalized.startsWith('fea') || normalized.startsWith('feb') ||
    normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.');
}

export function isPublicAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return !isPrivateIpv4(address);
  if (family === 6) return !isPrivateIpv6(address);
  return false;
}

export async function assertPublicHost(url) {
  const parsed = parseWebUrl(url);
  const records = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
  if (!records.length || records.some(record => !isPublicAddress(record.address))) {
    throw new Error('This address cannot be fetched safely.');
  }
}

async function readLimitedText(response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new Error('The page is too large to inspect.');
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

async function fetchHtml(startUrl, fetchImpl, publicHostCheck) {
  let current = parseWebUrl(startUrl).href;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await publicHostCheck(current);
    const response = await fetchImpl(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: {
        'user-agent': 'PersonalBookmarks/1.0 (+bookmark metadata fetch)',
        accept: 'text/html,application/xhtml+xml;q=0.9'
      }
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirect === MAX_REDIRECTS) throw new Error('Too many redirects.');
      current = new URL(location, current).href;
      continue;
    }

    if (!response.ok) throw new Error(`The page returned ${response.status}.`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/html') && !contentType.toLowerCase().includes('application/xhtml+xml')) {
      throw new Error('The address is not an HTML page.');
    }
    return { html: await readLimitedText(response), finalUrl: current };
  }
  throw new Error('Too many redirects.');
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function absoluteAsset(value, base) {
  if (!value) return null;
  try {
    const parsed = new URL(value, base);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

export async function fetchMetadata(url, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const publicHostCheck = options.publicHostCheck || assertPublicHost;
  const { html, finalUrl } = await fetchHtml(url, fetchImpl, publicHostCheck);
  const $ = cheerio.load(html);
  const siteName = clean($('meta[property="og:site_name"]').attr('content')) || siteNameFromUrl(finalUrl);
  const title = clean($('meta[property="og:title"]').attr('content')) || clean($('title').first().text());
  const description = clean($('meta[property="og:description"]').attr('content')) ||
    clean($('meta[name="description"]').attr('content')) || '';
  const iconHref = $('link[rel~="icon"]').first().attr('href') || '/favicon.ico';

  if (!title) throw new Error('The page did not provide a title.');
  return {
    title,
    description,
    siteName,
    faviconUrl: absoluteAsset(iconHref, finalUrl),
    fallback: false
  };
}

export async function metadataWithFallback(url, options = {}) {
  try {
    return await fetchMetadata(url, options);
  } catch (error) {
    const siteName = siteNameFromUrl(url);
    return {
      title: siteName,
      description: '',
      siteName,
      faviconUrl: null,
      fallback: true,
      reason: error.message
    };
  }
}

