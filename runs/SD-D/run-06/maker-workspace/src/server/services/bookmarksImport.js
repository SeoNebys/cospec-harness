import * as cheerio from 'cheerio';
import { normalizeUrl } from './normalizeUrl.js';
import { findByNormalizedUrl } from './duplicates.js';
import { createImported } from '../db/bookmarks.repo.js';
import { setBookmarkTags, addBookmarkTags } from '../db/tags.repo.js';

// Parse a Netscape bookmark HTML file and import entries, preserving titles,
// tags, and original dates; reconciling existing addresses (no duplicates) and
// merging same-named tags (FR-030/FR-031).
export function importNetscape(html) {
  const $ = cheerio.load(html);
  let imported = 0;
  let reconciled = 0;
  let skipped = 0;

  $('a').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href');
    if (!href) { skipped++; return; }

    let normalized, url;
    try {
      ({ normalized, url } = normalizeUrl(href));
    } catch {
      skipped++;
      return;
    }

    const title = ($a.text() || '').trim() || url;
    const tagsAttr = $a.attr('tags');
    const tags = tagsAttr ? tagsAttr.split(',').map((t) => t.trim()).filter(Boolean) : [];

    const addDate = $a.attr('add_date');
    let dateAdded = null;
    if (addDate && /^\d+$/.test(addDate)) {
      // ADD_DATE is Unix seconds.
      dateAdded = new Date(Number(addDate) * 1000).toISOString();
    }

    const existing = findByNormalizedUrl(normalized);
    if (existing) {
      if (tags.length) addBookmarkTags(existing.id, tags);
      reconciled++;
      return;
    }

    const created = createImported({ url, normalized, title, dateAdded });
    if (tags.length) setBookmarkTags(created.id, tags);
    imported++;
  });

  return { imported, reconciled, skipped };
}
