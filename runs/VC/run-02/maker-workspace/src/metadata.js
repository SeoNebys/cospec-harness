'use strict';

const cheerio = require('cheerio');

function absolutize(href, base) {
  if (!href) return '';
  try { return new URL(href, base).href; } catch { return ''; }
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

// Fetch a URL and extract title, description, favicon and preview image.
// Never throws: on failure returns best-effort values derived from the URL.
async function fetchMetadata(rawUrl) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const result = {
    url,
    title: '',
    description: '',
    icon: '',
    preview_image: '',
    domain: domainOf(url),
    ok: false,
    error: ''
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; BookmarkManager/1.0; +http://localhost)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    result.url = res.url || url;
    result.domain = domainOf(result.url);
    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('html')) {
      result.title = decodeURIComponent(result.url.split('/').pop()) || result.domain;
      result.ok = true;
      return result;
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    const metaProp = (names) => {
      for (const name of names) {
        const v =
          $(`meta[property="${name}"]`).attr('content') ||
          $(`meta[name="${name}"]`).attr('content');
        if (v && v.trim()) return v.trim();
      }
      return '';
    };

    result.title =
      metaProp(['og:title', 'twitter:title']) ||
      ($('title').first().text() || '').trim() ||
      result.domain;

    result.description = metaProp([
      'og:description',
      'twitter:description',
      'description'
    ]);

    result.preview_image = absolutize(
      metaProp(['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']),
      result.url
    );

    // favicon: prefer declared <link rel="icon">, largest available
    let iconHref = '';
    $('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
      .each((_, el) => {
        const href = $(el).attr('href');
        if (href && !iconHref) iconHref = href;
      });
    result.icon = iconHref
      ? absolutize(iconHref, result.url)
      : absolutize('/favicon.ico', result.url);

    result.ok = true;
    return result;
  } catch (e) {
    result.error = e.name === 'AbortError' ? 'timeout' : String(e.message || e);
    if (!result.title) result.title = result.domain || result.url;
    if (!result.icon) result.icon = absolutize('/favicon.ico', result.url);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchMetadata, domainOf };
