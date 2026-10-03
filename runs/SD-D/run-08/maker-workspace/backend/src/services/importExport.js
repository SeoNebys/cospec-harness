import * as cheerio from 'cheerio';
import { normalizeUrl, isValidWebUrl, fallbackTitle } from '../url/normalize.js';
import { getByUrlKey, create } from '../models/bookmarks.js';
import { getTagsForBookmark } from '../models/tags.js';
import { stmt } from '../db/index.js';

// Netscape Bookmark File Format import/export (FR-035, FR-036, FR-037).

/** ADD_DATE is Unix seconds; convert to ISO. */
function toIso(addDate) {
  if (!addDate) return null;
  const secs = Number(addDate);
  if (!Number.isFinite(secs) || secs <= 0) return null;
  return new Date(secs * 1000).toISOString();
}

/**
 * Parse a Netscape bookmark HTML file into records:
 * { url, title, tags: [folder names + TAGS attr], createdAt }
 * Folder structure (<H3>) maps to tags (FR-035).
 */
export function parseNetscape(html) {
  const $ = cheerio.load(html);
  const records = [];

  $('a').each((_, el) => {
    const $a = $(el);
    const url = $a.attr('href');
    if (!url || !isValidWebUrl(url)) return;

    // Folder path = enclosing <DL>'s preceding <H3> labels.
    const folders = [];
    $a.parents('dl').each((__, dl) => {
      const h3 = $(dl).prevAll('h3').first();
      const name = h3.text().trim();
      if (name) folders.push(name);
    });

    const tagAttr = ($a.attr('tags') || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const tags = [...new Set([...folders, ...tagAttr])];

    records.push({
      url,
      title: $a.text().trim() || fallbackTitle(url),
      tags,
      createdAt: toIso($a.attr('add_date')),
    });
  });

  return records;
}

/** Import records, skipping addresses already present by normalized key (FR-036). */
export function importNetscape(html) {
  const records = parseNetscape(html);
  let imported = 0;
  let skipped = 0;
  for (const rec of records) {
    const urlKey = normalizeUrl(rec.url);
    if (!urlKey) {
      skipped += 1;
      continue;
    }
    if (getByUrlKey(urlKey)) {
      skipped += 1;
      continue;
    }
    create({
      url: rec.url,
      urlKey,
      title: rec.title,
      description: '',
      note: null,
      tags: rec.tags,
      createdAt: rec.createdAt || undefined,
    });
    imported += 1;
  }
  return { imported, skipped };
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Export all bookmarks to Netscape HTML preserving titles, tags, and dates (FR-037). */
export function exportNetscape() {
  const rows = stmt('SELECT * FROM bookmarks ORDER BY created_at ASC').all();
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const row of rows) {
    const tags = getTagsForBookmark(row.id);
    const addDate = Math.floor(new Date(row.created_at).getTime() / 1000);
    const tagAttr = tags.length ? ` TAGS="${esc(tags.join(','))}"` : '';
    lines.push(
      `    <DT><A HREF="${esc(row.url)}" ADD_DATE="${addDate}"${tagAttr}>${esc(row.title)}</A>`
    );
  }
  lines.push('</DL><p>');
  return lines.join('\n');
}
