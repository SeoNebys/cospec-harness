import fs from 'node:fs';
import { assertPublicAddress, fallbackTitle, parseWebUrl } from './urls.js';
import { decodeEntities, stripTags } from './text.js';

const MAX_HTML_BYTES = 1_500_000;

function firstMatch(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1].trim());
  }
  return '';
}

function metaContent(html, key, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return firstMatch(html, [
    new RegExp(`<meta[^>]+${key}=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${key}=["']${escaped}["'][^>]*>`, 'i')
  ]);
}

function linkHref(html, relPattern) {
  return firstMatch(html, [
    new RegExp(`<link[^>]+rel=["'][^"']*${relPattern}[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*${relPattern}[^"']*["'][^>]*>`, 'i')
  ]);
}

export function extractMetadata(html, pageUrl) {
  const page = parseWebUrl(pageUrl);
  const title = metaContent(html, 'property', 'og:title')
    || metaContent(html, 'name', 'twitter:title')
    || firstMatch(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]);
  const description = metaContent(html, 'property', 'og:description')
    || metaContent(html, 'name', 'description')
    || metaContent(html, 'name', 'twitter:description');
  const image = metaContent(html, 'property', 'og:image')
    || metaContent(html, 'name', 'twitter:image');
  const icon = linkHref(html, '(?:shortcut\\s+icon|icon)');

  const resolve = (candidate, fallback = '') => {
    if (!candidate) return fallback;
    try {
      const resolved = new URL(candidate, page).toString();
      return ['http:', 'https:'].includes(new URL(resolved).protocol) ? resolved : fallback;
    } catch {
      return fallback;
    }
  };

  return {
    title: stripTags(title).slice(0, 500) || fallbackTitle(page),
    description: stripTags(description).slice(0, 2_000),
    siteName: metaContent(html, 'property', 'og:site_name').slice(0, 200)
      || page.hostname.replace(/^www\./, ''),
    siteIcon: resolve(icon, `${page.origin}/favicon.ico`),
    previewImage: resolve(image),
    metadataStatus: 'available'
  };
}

function readFixture(fixtureFile, url) {
  if (!fixtureFile) return null;
  const fixture = JSON.parse(fs.readFileSync(fixtureFile, 'utf8'));
  return fixture[url] ?? null;
}

export async function gatherMetadata(urlValue, options = {}) {
  const url = parseWebUrl(urlValue);
  const fixture = readFixture(options.fixtureFile, url.toString());
  if (fixture) return { ...fixture, metadataStatus: fixture.metadataStatus ?? 'available' };

  try {
    await assertPublicAddress(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 7_000);
    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'accept': 'text/html,application/xhtml+xml',
          'user-agent': 'StowBookmarkReader/1.0'
        }
      });
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('The page redirected without a destination.');
      const redirected = new URL(location, url);
      await assertPublicAddress(redirected);
      return gatherMetadata(redirected.toString(), options);
    }
    if (!response.ok) throw new Error(`The page returned ${response.status}.`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('text/html')) throw new Error('The address is not an HTML page.');
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return extractMetadata(html, response.url || url.toString());
  } catch (error) {
    if (options.throwOnFailure) throw error;
    return {
      title: fallbackTitle(url),
      description: '',
      siteName: url.hostname.replace(/^www\./, ''),
      siteIcon: `${url.origin}/favicon.ico`,
      previewImage: '',
      metadataStatus: 'unavailable'
    };
  }
}
