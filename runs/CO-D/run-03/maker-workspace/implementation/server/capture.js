'use strict';
// Fetch a page and pull out what we keep: title, image, summary, and a readable
// copy of the content (SCN-001 auto-capture, SCN-015 saved copy).
// Extraction (captureFromHtml) is separated from fetching (capture) so it can be
// tested without a network, and so the service layer can inject a fake capturer.

const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

function meta(doc, selectors) {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const v = el.getAttribute('content') || el.getAttribute('href') || el.textContent;
      if (v && v.trim()) return v.trim();
    }
  }
  return '';
}

function absolutize(url, maybeRelative) {
  if (!maybeRelative) return null;
  try { return new URL(maybeRelative, url).href; } catch { return null; }
}

// Pure extraction from an HTML string. Always returns an object; fields may be empty.
function captureFromHtml(url, html) {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  const title = meta(doc, ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'title']);
  const rawImage = meta(doc, ['meta[property="og:image"]', 'meta[name="twitter:image"]', 'link[rel="image_src"]']);
  const imageUrl = absolutize(url, rawImage);
  let summary = meta(doc, ['meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]']);

  let copyText = '';
  try {
    // Readability mutates the document, so clone first.
    const clone = doc.cloneNode(true);
    const article = new Readability(clone).parse();
    if (article) {
      copyText = (article.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
      if (!summary && article.excerpt) summary = article.excerpt.trim();
    }
  } catch {
    /* fall through to body text */
  }
  if (!copyText) {
    copyText = (doc.body ? doc.body.textContent : '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  if (!summary && copyText) summary = copyText.slice(0, 200).trim();

  return { title, summary, imageUrl, copyText };
}

// Fetch and capture. Returns:
//   { ok:true, title, summary, imageUrl, copyText }
//   { ok:false, reason:'unreachable'|'not-html'|'http-<status>' }
async function capture(url, opts = {}) {
  const timeoutMs = opts.timeoutMs || 12000;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BookmarksApp/1.0)' },
    });
    if (!res.ok) return { ok: false, reason: 'http-' + res.status };
    const ctype = res.headers.get('content-type') || '';
    if (ctype && !/text\/html|application\/xhtml/i.test(ctype)) {
      return { ok: false, reason: 'not-html' };
    }
    const html = await res.text();
    return { ok: true, ...captureFromHtml(url, html) };
  } catch {
    return { ok: false, reason: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { capture, captureFromHtml };
