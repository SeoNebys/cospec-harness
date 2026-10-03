// Best-effort page metadata capture (FR-003/FR-005).
// Plain fetch + cheerio first; Playwright/Chromium fallback for JS pages.
import * as cheerio from 'cheerio';

const FETCH_TIMEOUT = 12000;

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (BookmarkManager)' },
    });
    const contentType = res.headers.get('content-type') || '';
    const body = contentType.includes('text/html') ? await res.text() : '';
    return { html: body, contentType, finalUrl: res.url || url };
  } finally {
    clearTimeout(t);
  }
}

function extract($, baseUrl) {
  const abs = (u) => {
    if (!u) return null;
    try { return new URL(u, baseUrl).toString(); } catch { return null; }
  };
  const meta = (sel, attr = 'content') => {
    const el = $(sel).first();
    return el.length ? (el.attr(attr) || '').trim() : '';
  };

  const title =
    meta('meta[property="og:title"]') ||
    meta('meta[name="twitter:title"]') ||
    ($('title').first().text() || '').trim();

  const description =
    meta('meta[property="og:description"]') ||
    meta('meta[name="twitter:description"]') ||
    meta('meta[name="description"]');

  let preview =
    meta('meta[property="og:image"]') ||
    meta('meta[name="twitter:image"]');
  preview = abs(preview);

  // Favicon: rel icon variants, else default /favicon.ico
  let icon = '';
  $('link[rel]').each((_, el) => {
    const rel = ($(el).attr('rel') || '').toLowerCase();
    if (!icon && /(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/.test(rel)) {
      icon = $(el).attr('href') || '';
    }
  });
  icon = abs(icon) || abs('/favicon.ico');

  return { title, description, icon_url: icon, preview_image_url: preview };
}

async function fetchWithPlaywright(url) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: FETCH_TIMEOUT });
    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}

// Returns { title, description, icon_url, preview_image_url } best-effort.
// Never throws; on total failure returns empty fields.
export async function fetchMetadata(url) {
  const empty = { title: '', description: '', icon_url: '', preview_image_url: '' };
  try {
    const { html, contentType } = await fetchHtml(url);
    if (contentType.includes('application/pdf')) return empty;
    if (html) {
      const $ = cheerio.load(html);
      const data = extract($, url);
      if (data.title || data.description) return data;
      // Fall through to Playwright if the static HTML gave nothing useful.
    }
    try {
      const rendered = await fetchWithPlaywright(url);
      if (rendered) return extract(cheerio.load(rendered), url);
    } catch { /* ignore rendering failure */ }
    return empty;
  } catch {
    return empty;
  }
}
