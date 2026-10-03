import { parse } from 'node-html-parser';
import { canonicalKey } from '../lib/url.js';
import { createBookmark, findByUrlKey, setBookmarkFields } from '../models/bookmark.js';

/**
 * Import a Netscape bookmark HTML file. Preserves titles, tags (TAGS attribute),
 * and dates (ADD_DATE). Skips addresses already saved. Reports unreadable
 * entries. Returns { imported, skippedDuplicates, failed: [{reason, url?}] }.
 */
export function importNetscapeHtml(html) {
  const root = parse(String(html || ''), { blockTextElements: {} });
  const anchors = root.querySelectorAll('a');
  let imported = 0;
  let skippedDuplicates = 0;
  const failed = [];

  for (const a of anchors) {
    const href = a.getAttribute('href');
    if (!href) { failed.push({ reason: 'Missing address' }); continue; }
    try {
      const key = canonicalKey(href);
      if (findByUrlKey(key)) { skippedDuplicates++; continue; }

      const title = a.text?.trim() || undefined;
      const tagsAttr = a.getAttribute('tags');
      const tags = tagsAttr ? tagsAttr.split(',').map((t) => t.trim()).filter(Boolean) : [];

      const bookmark = createBookmark({ url: href, title, tags, metadataUnavailable: false });

      const addDate = a.getAttribute('add_date');
      if (addDate) {
        const seconds = parseInt(addDate, 10);
        if (Number.isFinite(seconds) && seconds > 0) {
          setBookmarkFields(bookmark.id, { date_added: new Date(seconds * 1000).toISOString() });
        }
      }
      imported++;
    } catch (err) {
      failed.push({ url: href, reason: err.message || 'Could not import entry' });
    }
  }

  return { imported, skippedDuplicates, failed };
}
