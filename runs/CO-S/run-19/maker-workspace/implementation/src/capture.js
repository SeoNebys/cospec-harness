import dns from 'node:dns/promises';
import net from 'node:net';
import { load } from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import { displayHost, parseWebUrl } from './url.js';

const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_EMBEDDED_IMAGES = 8;
const REDIRECT_LIMIT = 5;

export class CaptureError extends Error {
  constructor(message = 'We could not read this page.') {
    super(message);
    this.name = 'CaptureError';
    this.code = 'capture_failed';
    this.status = 422;
  }
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') ||
      normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
      normalized.startsWith('fea') || normalized.startsWith('feb');
  }
  return true;
}

async function assertPublicDestination(value, allowPrivate) {
  const url = parseWebUrl(value);
  if (allowPrivate) return url;
  if (url.hostname.toLowerCase() === 'localhost') throw new CaptureError('Private network addresses cannot be captured.');
  const directIp = net.isIP(url.hostname);
  let addresses;
  try {
    addresses = directIp ? [{ address: url.hostname }] : await dns.lookup(url.hostname, { all: true });
  } catch {
    throw new CaptureError('The page could not be reached. It may require sign-in or block saved copies.');
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new CaptureError('Private network addresses cannot be captured.');
  }
  return url;
}

async function readLimited(response, maximum) {
  const announced = Number(response.headers.get('content-length') || 0);
  if (announced > maximum) throw new CaptureError('This page is too large to capture safely.');
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new CaptureError('This page is too large to capture safely.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function safeFetch(value, { allowPrivate = false, method = 'GET', maximum = MAX_HTML_BYTES } = {}) {
  let current = (await assertPublicDestination(value, allowPrivate)).toString();
  for (let redirects = 0; redirects <= REDIRECT_LIMIT; redirects += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let response;
    try {
      response = await fetch(current, {
        method,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'Keepwell/1.0 personal bookmark archiver',
          accept: method === 'HEAD' ? '*/*' : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.2',
        },
      });
    } catch (error) {
      clearTimeout(timeout);
      throw new CaptureError(error.name === 'AbortError' ? 'The page took too long to respond.' : 'The page could not be reached.');
    }
    clearTimeout(timeout);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirects === REDIRECT_LIMIT) throw new CaptureError('The page redirected too many times.');
      current = new URL(location, current).toString();
      await assertPublicDestination(current, allowPrivate);
      continue;
    }
    if (!response.ok) throw new CaptureError(`The page returned ${response.status}.`);
    const body = method === 'HEAD' ? Buffer.alloc(0) : await readLimited(response, maximum);
    return { response, body, finalUrl: current };
  }
  throw new CaptureError('The page redirected too many times.');
}

function firstContent($, selectors) {
  for (const selector of selectors) {
    const element = $(selector).first();
    const value = element.attr('content') ?? element.text();
    if (value?.trim()) return value.trim();
  }
  return '';
}

function firstAttribute($, selectors, attribute) {
  for (const selector of selectors) {
    const value = $(selector).first().attr(attribute);
    if (value?.trim()) return value.trim();
  }
  return '';
}

function absoluteUrl(value, base) {
  if (!value) return '';
  try { return new URL(value, base).toString(); } catch { return ''; }
}

async function fetchImageAsDataUrl(value, options) {
  if (!value) return '';
  try {
    const { response, body } = await safeFetch(value, { ...options, maximum: MAX_IMAGE_BYTES });
    const type = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!type.startsWith('image/') || type === 'image/svg+xml') return '';
    return `data:${type};base64,${body.toString('base64')}`;
  } catch {
    return '';
  }
}

async function embedArticleImages(html, baseUrl, options) {
  const $ = load(`<main id="capture-root">${html}</main>`);
  const images = $('#capture-root img').slice(0, MAX_EMBEDDED_IMAGES).toArray();
  for (const image of images) {
    const element = $(image);
    const source = absoluteUrl(element.attr('src') || element.attr('data-src'), baseUrl);
    const embedded = await fetchImageAsDataUrl(source, options);
    if (embedded) element.attr('src', embedded);
    else element.remove();
    element.removeAttr('srcset sizes loading data-src');
  }
  $('#capture-root img').slice(MAX_EMBEDDED_IMAGES).remove();
  return $('#capture-root').html() ?? '';
}

export async function capturePage(value, { allowPrivate = false } = {}) {
  const { response, body, finalUrl } = await safeFetch(value, { allowPrivate });
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new CaptureError('This address did not return a readable webpage.');
  }
  const markup = body.toString('utf8');
  const $ = load(markup);
  const title = firstContent($, ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'title', 'h1']);
  if (!title) throw new CaptureError('The page did not provide a recognizable title.');
  const description = firstContent($, [
    'meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]',
    'article p', 'main p', 'p',
  ]).slice(0, 1000);
  const siteName = firstContent($, ['meta[property="og:site_name"]']) || displayHost(finalUrl);
  const author = firstContent($, ['meta[name="author"]', '[rel="author"]', '.byline', '[class*="author"]']).slice(0, 300);
  const publishedAt = (firstContent($, [
    'meta[property="article:published_time"]', 'meta[name="date"]',
  ]) || firstAttribute($, ['time[datetime]'], 'datetime')).slice(0, 100);
  const imageUrl = absoluteUrl(firstContent($, [
    'meta[property="og:image"]', 'meta[name="twitter:image"]',
  ]) || firstAttribute($, ['article img', 'main img', 'img'], 'src'), finalUrl);

  $('script,style,noscript,iframe,object,embed,form,button,input,textarea,select,nav,aside,[aria-hidden="true"]').remove();
  $('[style]').removeAttr('style');
  const candidate = $('article').first().length ? $('article').first() : $('main').first().length ? $('main').first() : $('body');
  candidate.find('a[href]').each((_, element) => {
    const href = absoluteUrl($(element).attr('href'), finalUrl);
    if (href) $(element).attr({ href, target: '_blank', rel: 'noreferrer noopener' });
    else $(element).removeAttr('href');
  });
  candidate.find('img').each((_, element) => {
    const source = absoluteUrl($(element).attr('src') || $(element).attr('data-src'), finalUrl);
    if (source) $(element).attr('src', source);
  });
  const sanitized = sanitizeHtml(candidate.html() ?? '', {
    allowedTags: ['p','h1','h2','h3','h4','h5','h6','blockquote','pre','code','ul','ol','li','strong','em','b','i','u','s','a','img','figure','figcaption','table','thead','tbody','tr','th','td','hr','br','div','section','span'],
    allowedAttributes: { a: ['href','target','rel'], img: ['src','alt','title'], '*': ['lang'] },
    allowedSchemes: ['http', 'https', 'data'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    transformTags: { div: 'section' },
  });
  const contentHtml = await embedArticleImages(sanitized, finalUrl, { allowPrivate });
  const previewImage = await fetchImageAsDataUrl(imageUrl, { allowPrivate });

  return {
    finalUrl,
    title: title.slice(0, 500),
    description,
    sourceHost: displayHost(finalUrl),
    siteName: siteName.slice(0, 300),
    author,
    publishedAt: publishedAt || null,
    previewImage,
    contentHtml,
    capturedAt: new Date().toISOString(),
  };
}

export async function checkPageAvailability(value, { allowPrivate = false } = {}) {
  try {
    await safeFetch(value, { allowPrivate, method: 'HEAD', maximum: 0 });
    return { available: true };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}
