import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { CAPTURES_DIR } from '../db/connection.js';

// Best-effort page preservation (FR-023, FR-025).
// - PDF addresses are stored as PDFs.
// - Everything else is rendered and serialized to a self-contained HTML file
//   with images and stylesheets inlined as data URIs.
// Never throws to the caller for network/render failure — returns status.

async function toDataUri(url, pageUrl) {
  try {
    const abs = new URL(url, pageUrl).href;
    if (abs.startsWith('data:')) return abs;
    const res = await fetch(abs, { redirect: 'follow' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function isPdf(url) {
  if (/\.pdf($|\?)/i.test(url)) return true;
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return (res.headers.get('content-type') || '').includes('pdf');
  } catch {
    return false;
  }
}

export async function capturePage(bookmarkId, url) {
  // PDF path — store original bytes as a .pdf (FR-023).
  if (await isPdf(url)) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error('fetch failed');
      const buf = Buffer.from(await res.arrayBuffer());
      const fileName = `${bookmarkId}.pdf`;
      await writeFile(join(CAPTURES_DIR, fileName), buf);
      return { kind: 'pdf', status: 'ready', filePath: fileName };
    } catch {
      return { kind: 'pdf', status: 'failed', filePath: null };
    }
  }

  // HTML path — render with the installed Chromium and inline assets.
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    const rendered = await page.content();
    const pageUrl = page.url();

    const $ = cheerio.load(rendered);
    $('script').remove();

    // Inline stylesheets.
    for (const el of $('link[rel="stylesheet"]').toArray()) {
      const href = $(el).attr('href');
      if (!href) continue;
      try {
        const abs = new URL(href, pageUrl).href;
        const res = await fetch(abs);
        if (res.ok) {
          const css = await res.text();
          $(el).replaceWith(`<style>${css}</style>`);
        }
      } catch {
        /* skip */
      }
    }
    // Inline images.
    for (const el of $('img').toArray()) {
      const src = $(el).attr('src');
      if (!src) continue;
      const dataUri = await toDataUri(src, pageUrl);
      if (dataUri) $(el).attr('src', dataUri);
      $(el).removeAttr('srcset');
    }
    // Record where it came from.
    $('head').prepend(`<!-- Captured from ${pageUrl} at ${new Date().toISOString()} -->`);

    const fileName = `${bookmarkId}.html`;
    await writeFile(join(CAPTURES_DIR, fileName), $.html());
    return { kind: 'html', status: 'ready', filePath: fileName };
  } catch {
    return { kind: 'html', status: 'failed', filePath: null };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
