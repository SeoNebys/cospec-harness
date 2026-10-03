import { mkdirSync, writeFileSync } from 'node:fs';
import { getBrowser } from './browser.js';
import { setSystemFields, getById } from '../db/bookmarks.repo.js';

const PRESERVE_DIR = process.env.PRESERVE_DIR || 'data/preserved';

function ensureDir() {
  mkdirSync(PRESERVE_DIR, { recursive: true });
}

// Detect whether the URL resolves to a PDF, returning { isPdf, buffer? }.
async function probe(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'BookmarkManager/1.0' },
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/pdf')) {
      const buffer = Buffer.from(await res.arrayBuffer());
      return { isPdf: true, buffer };
    }
    return { isPdf: false };
  } catch {
    return { isPdf: false };
  }
}

// Pure verifier: scan a serialized HTML document for references to EXTERNAL
// (http/https) subresources that would make it non-self-contained — images,
// stylesheets, and CSS url() assets (fonts, background images). Anchors and
// <meta>/OG tags are ignored (not loaded resources). Exported for testing.
export function findExternalResources(html) {
  const found = new Set();
  const add = (u) => { if (u) found.add(u); };

  // <img src="http..."> and <source src=...>
  const srcRe = /<(?:img|source|video|audio|track)\b[^>]*?\ssrc\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
  // srcset="http... 1x, http... 2x"
  const srcsetRe = /\ssrcset\s*=\s*["']([^"']*https?:\/\/[^"']*)["']/gi;
  // <link rel="...stylesheet..." href="http...">
  const linkRe = /<link\b[^>]*\brel\s*=\s*["'][^"']*stylesheet[^"']*["'][^>]*>/gi;
  const hrefRe = /\bhref\s*=\s*["'](https?:\/\/[^"']+)["']/i;
  // CSS url(http...) inside <style> or style="" attributes
  const cssUrlRe = /url\(\s*["']?(https?:\/\/[^"')]+)["']?\s*\)/gi;

  let m;
  while ((m = srcRe.exec(html))) add(m[1]);
  while ((m = srcsetRe.exec(html))) add(m[1]);
  while ((m = linkRe.exec(html))) { const h = hrefRe.exec(m[0]); if (h) add(h[1]); }
  while ((m = cssUrlRe.exec(html))) add(m[1]);

  return [...found];
}

// In-page embedding: inline stylesheets (+ their url() assets and one level of
// @import), images, and style-attribute url() assets as data URIs; strip
// scripts and resource hints so nothing external is fetched at view time.
// Best-effort — resources that cannot be fetched in-page are left for the
// server-side pass. Returns the mutated document HTML.
async function embedInPage(page) {
  await page.evaluate(async () => {
    const fetchAsDataUrl = async (url) => {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    };

    const inlineCssUrls = async (cssText, baseUrl) => {
      const matches = [...cssText.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)];
      for (const mm of matches) {
        const raw = mm[2].trim();
        if (!raw || raw.startsWith('data:')) continue;
        let abs;
        try { abs = new URL(raw, baseUrl).href; } catch { continue; }
        try {
          const dataUrl = await fetchAsDataUrl(abs);
          cssText = cssText.split(mm[0]).join(`url(${dataUrl})`);
        } catch { /* leave it; server pass or verifier will catch it */ }
      }
      return cssText;
    };

    // Stylesheets -> <style> with inlined url() assets and @import expansion.
    for (const link of [...document.querySelectorAll('link[rel~="stylesheet"][href]')]) {
      try {
        const href = link.href;
        let css = await (await fetch(href)).text();
        for (const im of [...css.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s]+)['"]?\s*\)?[^;]*;/gi)]) {
          try {
            const iu = new URL(im[1], href).href;
            const ic = await (await fetch(iu)).text();
            css = css.split(im[0]).join(await inlineCssUrls(ic, iu));
          } catch { /* ignore */ }
        }
        css = await inlineCssUrls(css, href);
        const style = document.createElement('style');
        style.textContent = css;
        link.replaceWith(style);
      } catch { /* leave the link; verifier will flag it */ }
    }

    // Existing <style> blocks: inline their url() assets.
    for (const style of [...document.querySelectorAll('style')]) {
      try { style.textContent = await inlineCssUrls(style.textContent, document.baseURI); } catch { /* ignore */ }
    }

    // Images -> data URIs (prefer the actually-rendered source).
    for (const img of [...document.querySelectorAll('img')]) {
      const src = img.currentSrc || img.src;
      img.removeAttribute('srcset');
      if (!src || src.startsWith('data:')) continue;
      try { img.setAttribute('src', await fetchAsDataUrl(src)); } catch { /* leave src */ }
    }
    // <picture>/<source> variants are redundant once <img> is inlined.
    for (const s of [...document.querySelectorAll('source')]) s.remove();

    // Inline style attributes with url() assets.
    for (const node of [...document.querySelectorAll('[style]')]) {
      const st = node.getAttribute('style');
      if (st && /url\(/i.test(st)) {
        try { node.setAttribute('style', await inlineCssUrls(st, document.baseURI)); } catch { /* ignore */ }
      }
    }

    // Strip external code / resource hints that aren't needed for a static copy.
    for (const s of [...document.querySelectorAll('script')]) s.remove();
    for (const l of [...document.querySelectorAll(
      'link[rel~="preload"],link[rel~="prefetch"],link[rel~="modulepreload"],link[rel~="dns-prefetch"],link[rel~="preconnect"]'
    )]) l.remove();
    // External favicons/touch icons would be fetched on view; inline or drop.
    for (const l of [...document.querySelectorAll('link[rel~="icon"],link[rel~="apple-touch-icon"]')]) {
      const href = l.getAttribute('href') || '';
      if (/^https?:/i.test(href)) {
        try { l.setAttribute('href', await fetchAsDataUrl(l.href)); } catch { l.remove(); }
      }
    }
  });
}

// Server-side second pass: for any external URLs the in-page pass could not fetch
// (e.g. CORS-restricted), fetch them without CORS and inline as data URIs by
// string substitution. Returns the updated HTML.
async function embedRemainingServerSide(html, urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(12_000), headers: { 'User-Agent': 'BookmarkManager/1.0' } });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') || 'application/octet-stream';
      const buf = Buffer.from(await res.arrayBuffer());
      const dataUrl = `data:${ct.split(';')[0]};base64,${buf.toString('base64')}`;
      html = html.split(url).join(dataUrl);
    } catch { /* leave it; verifier will flag as not self-contained */ }
  }
  return html;
}

// Produce a genuinely self-contained HTML snapshot. Returns { html, external }
// where `external` is the list of resource URLs that could NOT be embedded.
async function snapshotHtml(url) {
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: 'BookmarkManager/1.0' });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 }).catch(async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    });

    await embedInPage(page);
    let html = await page.content();

    // Second pass for anything still external, then verify.
    let external = findExternalResources(html);
    if (external.length) {
      html = await embedRemainingServerSide(html, external);
      external = findExternalResources(html);
    }

    html = `<!-- Preserved by Bookmark Manager from ${url} on ${new Date().toISOString()} -->\n${html}`;
    return { html, external };
  } finally {
    await context.close().catch(() => {});
  }
}

// Preserve a local copy: original PDF for a PDF link, else a self-contained HTML
// file. A page snapshot is only marked 'ready' when it is genuinely
// self-contained (no external image/style/font references remain); otherwise it
// is marked 'failed' rather than presented as a successful self-contained copy
// (FR-026/FR-027/FR-029).
export async function preserveLocal(bookmarkId, url) {
  if (!getById(bookmarkId)) return;
  setSystemFields(bookmarkId, { preserved_status: 'pending' });
  ensureDir();
  try {
    const { isPdf, buffer } = await probe(url);
    if (isPdf) {
      const path = `${PRESERVE_DIR}/${bookmarkId}.pdf`;
      writeFileSync(path, buffer);
      setSystemFields(bookmarkId, { preserved_path: path, preserved_kind: 'pdf', preserved_status: 'ready' });
      return;
    }

    const { html, external } = await snapshotHtml(url);
    if (external.length > 0) {
      // Not genuinely self-contained — do not claim success.
      console.warn(`Preservation of bookmark ${bookmarkId} not self-contained; ${external.length} external resource(s) could not be embedded, e.g. ${external.slice(0, 3).join(', ')}`);
      setSystemFields(bookmarkId, { preserved_path: null, preserved_kind: null, preserved_status: 'failed' });
      return;
    }

    const path = `${PRESERVE_DIR}/${bookmarkId}.html`;
    writeFileSync(path, html, 'utf8');
    setSystemFields(bookmarkId, { preserved_path: path, preserved_kind: 'html', preserved_status: 'ready' });
  } catch {
    if (getById(bookmarkId)) setSystemFields(bookmarkId, { preserved_status: 'failed' });
  }
}
