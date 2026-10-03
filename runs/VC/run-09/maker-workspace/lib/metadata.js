import * as cheerio from 'cheerio';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { SNAPSHOT_DIR } from '../db.js';

const UA =
  'Mozilla/5.0 (compatible; BookmarkManager/1.0; +local)';

function absUrl(href, base) {
  if (!href) return '';
  try {
    return new URL(href, base).href;
  } catch {
    return '';
  }
}

async function fetchWithTimeout(url, ms = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html,*/*' },
      redirect: 'follow',
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Best-effort. Never throws; returns whatever it managed to extract plus the
// raw HTML (for snapshotting) and an `ok`/`error` status.
export async function fetchMetadata(url) {
  const result = {
    ok: false,
    error: '',
    title: '',
    description: '',
    favicon: '',
    preview_image: '',
    html: '',
    finalUrl: url,
  };
  try {
    const res = await fetchWithTimeout(url);
    result.finalUrl = res.url || url;
    if (!res.ok) {
      result.error = `HTTP ${res.status}`;
    }
    const type = res.headers.get('content-type') || '';
    if (!type.includes('html')) {
      result.error = result.error || `Not HTML (${type || 'unknown'})`;
      result.ok = true; // reachable, just nothing to parse
      return result;
    }
    const html = await res.text();
    result.html = html;
    const $ = cheerio.load(html);
    const base = result.finalUrl;

    const pick = (...sels) => {
      for (const sel of sels) {
        const el = $(sel).first();
        const v = (el.attr('content') || el.text() || '').trim();
        if (v) return v;
      }
      return '';
    };

    result.title = pick(
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'title'
    );
    result.description = pick(
      'meta[property="og:description"]',
      'meta[name="description"]',
      'meta[name="twitter:description"]'
    );
    const img = pick('meta[property="og:image"]', 'meta[name="twitter:image"]');
    result.preview_image = absUrl(img, base);

    let icon =
      $('link[rel~="icon"]').first().attr('href') ||
      $('link[rel="shortcut icon"]').first().attr('href') ||
      $('link[rel="apple-touch-icon"]').first().attr('href') ||
      '';
    if (!icon) icon = '/favicon.ico';
    result.favicon = absUrl(icon, base);

    result.ok = true;
    return result;
  } catch (err) {
    result.error = err.name === 'AbortError' ? 'Timed out' : err.message;
    return result;
  }
}

// Save a local single-file snapshot of the page HTML. Adds a <base> tag so the
// browser resolves relative assets/links against the original site.
export async function saveSnapshot(id, html, finalUrl) {
  if (!html) return '';
  let doc = html;
  const baseTag = `<base href="${finalUrl.replace(/"/g, '&quot;')}">`;
  if (/<head[^>]*>/i.test(doc)) {
    doc = doc.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  } else {
    doc = baseTag + doc;
  }
  const banner =
    `<div style="position:sticky;top:0;z-index:2147483647;background:#1f2937;` +
    `color:#fff;font:13px system-ui,sans-serif;padding:6px 12px">` +
    `Local snapshot &middot; original: ` +
    `<a href="${finalUrl.replace(/"/g, '&quot;')}" style="color:#93c5fd">${finalUrl.replace(/</g, '&lt;')}</a></div>`;
  if (/<body[^>]*>/i.test(doc)) {
    doc = doc.replace(/<body([^>]*)>/i, `<body$1>${banner}`);
  } else {
    doc = banner + doc;
  }
  const rel = join('snapshots', `${id}.html`);
  await writeFile(join(SNAPSHOT_DIR, `${id}.html`), doc, 'utf8');
  return rel;
}
