'use strict';
// Page/PDF capture and metadata collection (SCN-001 auto-fill, SCN-014 preserve).
// Uses global fetch (Node 18+). A fetch implementation can be injected for tests.
const { isPdf } = require('./util');

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim();
}
function extractTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
}
function extractDescription(html) {
  const metas = html.match(/<meta[^>]+>/gi) || [];
  for (const tag of metas) {
    const name = /(?:name|property)\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (name && /^(description|og:description)$/i.test(name[1])) {
      const c = /content\s*=\s*["']([\s\S]*?)["']/i.exec(tag);
      if (c) return decodeEntities(c[1]).replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}
function titleFromUrl(url) {
  try {
    const u = new URL(url);
    const base = (u.pathname.split('/').filter(Boolean).pop() || u.hostname);
    return decodeURIComponent(base).replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim() || u.hostname;
  } catch (e) { return url; }
}

// Wrap captured HTML into a self-contained-ish snapshot: a <base> so links
// resolve, plus a banner recording capture time and original address.
function buildSnapshot(url, html, when) {
  const banner = '<div style="background:#fef3c7;border-bottom:1px solid #fde68a;padding:10px 16px;'
    + 'font:14px system-ui;color:#92400e">\u{1F4CC} Saved copy of the page as it was when you bookmarked it '
    + '— captured ' + new Date(when).toISOString()
    + ' · original address: ' + escapeHtml(url) + '</div>';
  const baseTag = '<base href="' + escapeAttr(url) + '">';
  let out = html || '';
  if (/<head[^>]*>/i.test(out)) out = out.replace(/<head([^>]*)>/i, '<head$1>' + baseTag);
  else out = baseTag + out;
  if (/<body[^>]*>/i.test(out)) out = out.replace(/<body([^>]*)>/i, '<body$1>' + banner);
  else out = banner + out;
  return out;
}
function escapeHtml(s) { return String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function escapeAttr(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// Best-effort inline of <img> assets so the copy works offline. Capped and
// guarded so a slow/broken asset never blocks the capture.
async function inlineImages(url, html, fetchImpl, budget) {
  const imgRe = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const seen = new Map();
  let m, count = 0;
  const tasks = [];
  while ((m = imgRe.exec(html)) && count < budget.maxImages) {
    const src = m[1];
    if (/^data:/i.test(src)) continue;
    if (!seen.has(src)) { seen.set(src, null); count++; }
  }
  for (const src of seen.keys()) {
    tasks.push((async () => {
      try {
        const abs = new URL(src, url).href;
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), budget.perAssetMs);
        const r = await fetchImpl(abs, { signal: ac.signal });
        clearTimeout(t);
        if (!r.ok) return;
        const ct = r.headers.get('content-type') || 'image/png';
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > budget.maxAssetBytes) return;
        seen.set(src, 'data:' + ct + ';base64,' + buf.toString('base64'));
      } catch (e) { /* leave as-is */ }
    })());
  }
  await Promise.all(tasks);
  return html.replace(imgRe, (tag, src) => {
    const data = seen.get(src);
    return data ? tag.replace(src, data) : tag;
  });
}

// Fetch a URL and produce metadata + a preserved copy.
// Returns { readable, kind, title, description, snapshotHtml?, pdfBuffer? }.
async function capture(url, opts = {}) {
  const fetchImpl = opts.fetch || globalThis.fetch;
  const timeoutMs = opts.timeoutMs || 8000;
  const budget = opts.assetBudget || { maxImages: 25, maxAssetBytes: 2_000_000, perAssetMs: 4000 };
  const when = opts.now || Date.now();
  if (!fetchImpl) return { readable: false };
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetchImpl(url, { redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    if (!res.ok) return { readable: false };
    const ct = res.headers.get('content-type') || '';
    if (isPdf(url, ct)) {
      const buf = Buffer.from(await res.arrayBuffer());
      return { readable: true, kind: 'pdf', title: titleFromUrl(url), description: '', pdfBuffer: buf };
    }
    const html = await res.text();
    const title = extractTitle(html) || titleFromUrl(url);
    const description = extractDescription(html);
    let inlined = html;
    if (opts.inlineImages !== false) {
      try { inlined = await inlineImages(url, html, fetchImpl, budget); } catch (e) { inlined = html; }
    }
    const snapshotHtml = buildSnapshot(url, inlined, when);
    return { readable: true, kind: 'page', title, description, snapshotHtml };
  } catch (e) {
    return { readable: false };
  }
}

module.exports = { capture, extractTitle, extractDescription, titleFromUrl, buildSnapshot };
