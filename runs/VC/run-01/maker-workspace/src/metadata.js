'use strict';

// Fetch a page and extract title, description and favicon URL.
// Fully graceful: on any failure returns empty fields so the client can fall
// back to manual entry.

function decodeEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .trim();
}

function attr(tag, name) {
  const re = new RegExp(name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i');
  const m = re.exec(tag);
  if (!m) return '';
  return decodeEntities(m[2] || m[3] || m[4] || '');
}

function absoluteUrl(href, base) {
  try { return new URL(href, base).href; } catch { return ''; }
}

async function fetchMetadata(rawUrl) {
  const result = { url: rawUrl, title: '', description: '', favicon: '', ok: false, error: '' };
  let target;
  try { target = new URL(rawUrl); } catch { result.error = 'Invalid URL'; return result; }
  if (!/^https?:$/.test(target.protocol)) { result.error = 'Unsupported protocol'; return result; }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(target.href, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BookmarkManager/1.0)', 'Accept': 'text/html,application/xhtml+xml' }
    });
    const finalUrl = res.url || target.href;
    const ct = res.headers.get('content-type') || '';
    if (!/html|xml|text/.test(ct)) {
      // Non-HTML (e.g. a PDF): still a valid bookmark, use filename as title.
      result.ok = true;
      result.title = decodeURIComponent(target.pathname.split('/').pop() || target.hostname);
      result.favicon = absoluteUrl('/favicon.ico', finalUrl);
      return result;
    }
    const html = (await res.text()).slice(0, 500000);

    const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    let title = titleTag ? decodeEntities(titleTag[1].replace(/\s+/g, ' ')) : '';

    let description = '';
    let favicon = '';
    const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
    for (const tag of metaTags) {
      const prop = (attr(tag, 'property') || attr(tag, 'name')).toLowerCase();
      if (!title && (prop === 'og:title' || prop === 'twitter:title')) title = attr(tag, 'content');
      if (!description && (prop === 'description' || prop === 'og:description' || prop === 'twitter:description')) {
        description = attr(tag, 'content');
      }
    }
    const linkTags = html.match(/<link\b[^>]*>/gi) || [];
    for (const tag of linkTags) {
      const rel = attr(tag, 'rel').toLowerCase();
      if (/icon/.test(rel)) { favicon = absoluteUrl(attr(tag, 'href'), finalUrl); if (rel === 'icon' || rel === 'shortcut icon') break; }
    }
    if (!favicon) favicon = absoluteUrl('/favicon.ico', finalUrl);

    result.ok = true;
    result.title = title || target.hostname;
    result.description = description;
    result.favicon = favicon;
    return result;
  } catch (err) {
    result.error = err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Fetch failed');
    return result;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchMetadata };
