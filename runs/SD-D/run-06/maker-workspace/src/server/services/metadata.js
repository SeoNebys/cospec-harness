import { getBrowser } from './browser.js';
import { setSystemFields, getById } from '../db/bookmarks.repo.js';

// Asynchronously capture title/description/icon/preview for a bookmark.
// Best-effort: never throws to the caller; sets metadata_status ready/failed
// (FR-003/FR-005). Only fills the title if the user did not provide one.
export async function captureMetadata(bookmarkId, url, { keepTitle = false } = {}) {
  let context;
  try {
    const browser = await getBrowser();
    context = await browser.newContext({ userAgent: 'BookmarkManager/1.0' });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });

    const meta = await page.evaluate(() => {
      const pick = (sel, attr) => {
        const el = document.querySelector(sel);
        return el ? el.getAttribute(attr) : null;
      };
      const abs = (href) => {
        if (!href) return null;
        try { return new URL(href, document.baseURI).href; } catch { return null; }
      };
      const title =
        pick('meta[property="og:title"]', 'content') ||
        (document.title || '').trim() ||
        null;
      const description =
        pick('meta[property="og:description"]', 'content') ||
        pick('meta[name="description"]', 'content') ||
        null;
      const preview =
        abs(pick('meta[property="og:image"]', 'content')) ||
        abs(pick('meta[name="twitter:image"]', 'content')) ||
        null;
      const icon = abs(
        pick('link[rel="apple-touch-icon"]', 'href') ||
        pick('link[rel="icon"]', 'href') ||
        pick('link[rel="shortcut icon"]', 'href') ||
        '/favicon.ico'
      );
      return { title, description, preview, icon };
    });

    const fields = {
      description: meta.description || null,
      icon_url: meta.icon || null,
      preview_image_url: meta.preview || null,
      metadata_status: 'ready',
    };
    // Respect a user-supplied title; otherwise adopt the page title if we have one.
    if (!keepTitle && meta.title) fields.title = meta.title;

    // Only apply if the bookmark still exists.
    if (getById(bookmarkId)) setSystemFields(bookmarkId, fields);
  } catch {
    if (getById(bookmarkId)) setSystemFields(bookmarkId, { metadata_status: 'failed' });
  } finally {
    if (context) await context.close().catch(() => {});
  }
}
