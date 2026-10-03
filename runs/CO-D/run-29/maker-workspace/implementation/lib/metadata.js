import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_HTML_BYTES = 2_000_000;

export async function fetchPageDetails(address, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  if (!options.allowPrivate) await assertPublicAddress(address);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(address, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'PersonalBookmarks/1.0 (+metadata preview)',
        accept: 'text/html,application/xhtml+xml'
      }
    });
    if (!response.ok) throw new Error(`Page returned ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!/html|xhtml/i.test(contentType)) throw new Error('Page is not HTML');
    const html = await readLimitedText(response, MAX_HTML_BYTES);
    return extractPageDetails(html, response.url || address);
  } finally {
    clearTimeout(timeout);
  }
}

export function extractPageDetails(html, address) {
  const base = new URL(address);
  const metas = extractMetaTags(html);
  const title = firstNonEmpty(
    metaValue(metas, 'property', 'og:title'),
    metaValue(metas, 'name', 'twitter:title'),
    extractTagText(html, 'title')
  );
  const description = firstNonEmpty(
    metaValue(metas, 'property', 'og:description'),
    metaValue(metas, 'name', 'description'),
    metaValue(metas, 'name', 'twitter:description')
  );
  const previewCandidate = firstNonEmpty(
    metaValue(metas, 'property', 'og:image'),
    metaValue(metas, 'name', 'twitter:image')
  );
  const iconCandidate = extractIcon(html);
  const siteName = firstNonEmpty(metaValue(metas, 'property', 'og:site_name'), base.hostname.replace(/^www\./, ''));

  return {
    title: cleanText(title),
    description: cleanText(description),
    previewUrl: absoluteUrl(previewCandidate, base),
    iconUrl: absoluteUrl(iconCandidate, base) ?? new URL('/favicon.ico', base).href,
    siteName: cleanText(siteName)
  };
}

async function assertPublicAddress(address) {
  const url = new URL(address);
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some(record => isPrivateAddress(record.address))) {
    throw new Error('Private network addresses cannot be retrieved');
  }
}

function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const lower = address.toLowerCase();
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
}

async function readLimitedText(response, limit) {
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) throw new Error('Page is too large to preview');
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

function extractMetaTags(html) {
  return [...html.matchAll(/<meta\s+([^>]+)>/gi)].map(match => parseAttributes(match[1]));
}

function metaValue(metas, attribute, expected) {
  const found = metas.find(meta => meta[attribute]?.toLowerCase() === expected.toLowerCase());
  return found?.content ?? '';
}

function extractIcon(html) {
  for (const match of html.matchAll(/<link\s+([^>]+)>/gi)) {
    const attrs = parseAttributes(match[1]);
    if (/\b(?:shortcut\s+)?icon\b/i.test(attrs.rel ?? '') && attrs.href) return attrs.href;
  }
  return '';
}

function extractTagText(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match?.[1] ?? '';
}

function parseAttributes(source) {
  const attributes = {};
  for (const match of source.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function cleanText(value) {
  return decodeEntities(String(value ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)));
}

function absoluteUrl(value, base) {
  if (!value) return null;
  try { return new URL(value, base).href; } catch { return null; }
}

function firstNonEmpty(...values) {
  return values.find(value => String(value ?? '').trim()) ?? '';
}
