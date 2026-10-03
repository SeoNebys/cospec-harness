import fs from 'node:fs';
import path from 'node:path';
import { SNAPSHOT_DIR } from '../db/index.js';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) BookmarkManager/1.0';
const NAV_TIMEOUT_MS = 30000;
const MAX_ASSET_BYTES = 5 * 1024 * 1024;

function bookmarkDir(id) {
  const dir = path.join(SNAPSHOT_DIR, String(id));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NAV_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal, headers: { 'user-agent': UA } });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchDataUri(url) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_ASSET_BYTES) return null;
    const type = res.headers.get('content-type') || 'application/octet-stream';
    return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Capture a snapshot of a page (FR-038, FR-039).
 * - HTML → a self-contained single .html file (CSS inlined, images as data: URIs,
 *   scripts removed, a CSP meta blocking any remaining external fetch) that renders
 *   offline without contacting the origin.
 * - PDF source → the original PDF stored byte-for-byte.
 * Returns { path, kind }. Throws on failure so the caller can record 'failed' (FR-041).
 */
export async function captureSnapshot(id, url) {
  const dir = bookmarkDir(id);

  // Detect PDF sources and store them as-is.
  let contentType = '';
  try {
    const probe = await fetchWithTimeout(url);
    contentType = (probe.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/pdf') || new URL(url).pathname.toLowerCase().endsWith('.pdf')) {
      const buf = Buffer.from(await probe.arrayBuffer());
      fs.writeFileSync(path.join(dir, 'snapshot.pdf'), buf);
      return { path: 'snapshot.pdf', kind: 'pdf' };
    }
  } catch {
    // fall through to HTML capture
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: UA });
    await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS });

    const { cssHrefs, imgSrcs } = await page.evaluate(() => ({
      cssHrefs: [...document.querySelectorAll('link[rel~="stylesheet"]')]
        .map((l) => l.href)
        .filter(Boolean),
      imgSrcs: [...document.querySelectorAll('img')]
        .map((i) => i.currentSrc || i.src)
        .filter(Boolean),
    }));

    const cssTexts = {};
    for (const href of [...new Set(cssHrefs)]) cssTexts[href] = await fetchText(href);
    const imgData = {};
    for (const src of [...new Set(imgSrcs)]) imgData[src] = await fetchDataUri(src);

    await page.evaluate(
      ({ cssTexts, imgData }) => {
        document.querySelectorAll('link[rel~="stylesheet"]').forEach((l) => {
          const css = cssTexts[l.href];
          if (css != null) {
            const s = document.createElement('style');
            s.textContent = css;
            l.replaceWith(s);
          } else {
            l.remove();
          }
        });
        document.querySelectorAll('img').forEach((img) => {
          const key = img.currentSrc || img.src;
          if (imgData[key]) img.setAttribute('src', imgData[key]);
          img.removeAttribute('srcset');
          img.removeAttribute('loading');
        });
        document.querySelectorAll('script').forEach((s) => s.remove());
        document
          .querySelectorAll(
            'link[rel="preload"],link[rel="prefetch"],link[rel="dns-prefetch"],link[rel="preconnect"],link[rel="modulepreload"]'
          )
          .forEach((l) => l.remove());
        const meta = document.createElement('meta');
        meta.setAttribute('http-equiv', 'Content-Security-Policy');
        meta.setAttribute(
          'content',
          "default-src 'none'; img-src data:; style-src 'unsafe-inline' data:; font-src data:; media-src data:"
        );
        document.head && document.head.prepend(meta);
      },
      { cssTexts, imgData }
    );

    const html = await page.content();
    fs.writeFileSync(path.join(dir, 'snapshot.html'), `<!DOCTYPE html>\n${html}`);
    return { path: 'snapshot.html', kind: 'html' };
  } finally {
    await browser.close();
  }
}
