// Fetch a page and extract recognizable details (SCN-001, SCN-017).
// Never throws: on any failure it returns retrieved:false with sensible fallbacks.
'use strict';

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)); })
    .trim();
}

function pick(html, patterns) {
  for (var i = 0; i < patterns.length; i++) {
    var m = patterns[i].exec(html);
    if (m && m[1] && m[1].trim()) return decodeEntities(m[1]);
  }
  return '';
}

function faviconFor(host) {
  return 'https://www.google.com/s2/favicons?domain=' + host + '&sz=64';
}

async function fetchMetadata(url, opts) {
  opts = opts || {};
  var timeoutMs = opts.timeoutMs || 8000;
  var parsed = new URL(url);
  var host = parsed.hostname.replace(/^www\./, '');
  var result = { title: '', description: '', siteName: host, image: '', favicon: faviconFor(host), retrieved: false };
  try {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    var res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BookmarkLibrary/1.0)' },
      signal: controller.signal, redirect: 'follow',
    });
    clearTimeout(timer);
    var html = (await res.text()).slice(0, 400000);

    result.title = pick(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    ]);
    result.description = pick(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    ]);
    var site = pick(html, [
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
    ]);
    if (site) result.siteName = site;
    var img = pick(html, [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ]);
    if (img) { try { result.image = new URL(img, url).toString(); } catch (e) { result.image = ''; } }
    result.retrieved = true;
  } catch (e) {
    result.retrieved = false;
  }
  if (!result.title) result.title = host + parsed.pathname.replace(/\/$/, '');
  return result;
}

module.exports = { fetchMetadata: fetchMetadata, faviconFor: faviconFor };
