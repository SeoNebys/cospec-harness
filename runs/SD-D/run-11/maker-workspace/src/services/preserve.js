// Local page preservation (FR-024): self-contained HTML for web pages,
// PDFs stored as PDFs. Uses the image's shared Playwright/Chromium binaries.
import fs from 'node:fs';
import path from 'node:path';
import sanitizeHtml from 'sanitize-html';
import { PRESERVED_DIR } from '../db/index.js';

process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/playwright-browsers';

const FETCH_TIMEOUT_MS = 20000;

function fileFor(id, ext) {
  return path.join(PRESERVED_DIR, `bookmark-${id}.${ext}`);
}

async function inlineImages(page) {
  // Replace <img src> and CSS background images with data URIs where possible.
  await page.evaluate(async () => {
    async function toDataUri(url) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        return await new Promise((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = () => resolve(null);
          fr.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    }
    const imgs = Array.from(document.images);
    for (const img of imgs) {
      if (img.src && !img.src.startsWith('data:')) {
        const d = await toDataUri(img.src);
        if (d) img.setAttribute('src', d);
      }
    }
  });
}

/**
 * Preserve a page for a bookmark. Returns { kind, filePath }.
 * Throws on failure so the caller can keep the bookmark and inform the user.
 */
export async function preserve(bookmarkId, url) {
  // Inspect content type first to detect PDFs.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let contentType = '';
  let headBuffer = null;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+local)' },
    });
    contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
      const buf = Buffer.from(await res.arrayBuffer());
      const filePath = fileFor(bookmarkId, 'pdf');
      fs.writeFileSync(filePath, buf);
      return { kind: 'pdf', filePath };
    }
    headBuffer = await res.text();
  } catch (e) {
    clearTimeout(timer);
    throw new Error(`Could not fetch page for preservation: ${e.message}`);
  }
  clearTimeout(timer);

  // HTML page → render in Chromium, inline resources, serialise self-contained.
  const { chromium } = await import('playwright');
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(headBuffer, { waitUntil: 'load', timeout: FETCH_TIMEOUT_MS }).catch(async () => {
      // Fallback: navigate directly if setContent lacks a base for resources.
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: FETCH_TIMEOUT_MS });
    });
    // If navigation is preferable (relative assets), prefer a real load.
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: FETCH_TIMEOUT_MS });
    } catch {
      /* keep setContent result */
    }
    await inlineImages(page).catch(() => {});

    // Inline stylesheets by pulling their text into <style> elements.
    await page
      .evaluate(async () => {
        const links = Array.from(
          document.querySelectorAll('link[rel="stylesheet"]')
        );
        for (const link of links) {
          try {
            const res = await fetch(link.href);
            const css = await res.text();
            const style = document.createElement('style');
            style.textContent = css;
            link.replaceWith(style);
          } catch {
            /* skip */
          }
        }
      })
      .catch(() => {});

    let html = await page.content();
    // Strip scripts for a safe, static self-contained artifact.
    html = sanitizeHtml(html, {
      allowedTags: false, // allow all tags...
      allowedAttributes: false, // ...and attributes...
      allowVulnerableTags: true,
      exclusiveFilter: (frame) => frame.tag === 'script',
    });
    const filePath = fileFor(bookmarkId, 'html');
    fs.writeFileSync(filePath, html, 'utf8');
    return { kind: 'html', filePath };
  } finally {
    if (browser) await browser.close();
  }
}
