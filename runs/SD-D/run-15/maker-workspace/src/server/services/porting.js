// T058 [US12]: import/export the standard Netscape bookmark HTML format.
// Preserves title, tags, and original date added; folders map to tags; skips dupes.
import * as cheerio from 'cheerio';
import * as Bookmark from '../models/bookmark.js';
import * as Tag from '../models/tag.js';
import { normalizeUrl } from '../lib/url.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

function isoToUnix(iso) {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? Math.floor(Date.now() / 1000) : Math.floor(ms / 1000);
}

function unixToIso(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

/** Build a Netscape bookmark file from hydrated bookmarks (FR-033). */
export function exportHtml(bookmarks) {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const b of bookmarks) {
    const attrs = [
      `HREF="${escapeHtml(b.url)}"`,
      `ADD_DATE="${isoToUnix(b.date_added)}"`,
    ];
    if (b.tags && b.tags.length) attrs.push(`TAGS="${escapeHtml(b.tags.join(','))}"`);
    lines.push(`    <DT><A ${attrs.join(' ')}>${escapeHtml(b.title || b.url)}</A>`);
  }
  lines.push('</DL><p>', '');
  return lines.join('\n');
}

/** Tags contributed by enclosing <H3> folders for an <A> element. */
function folderTags($, aEl) {
  const names = [];
  let dl = $(aEl).closest('dl');
  const guard = new Set();
  while (dl.length && !guard.has(dl[0])) {
    guard.add(dl[0]);
    // The folder title is an <H3> in the <DT> that precedes this <DL>.
    let h3 = dl.prevAll('dt').first().find('h3').first();
    if (!h3.length) h3 = dl.prevAll('h3').first();
    const text = h3.text().trim();
    if (text) names.unshift(text);
    dl = dl.parent().closest('dl');
  }
  return names;
}

/**
 * Import a Netscape bookmark file (FR-034). Preserves title, tags, and original
 * date added; maps folders to tags; skips addresses already saved.
 * @returns {{added:number, skipped:number}}
 */
export function importHtml(buffer) {
  const $ = cheerio.load(buffer.toString('utf8'));
  let added = 0;
  let skipped = 0;

  $('a').each((_, aEl) => {
    const a = $(aEl);
    const href = a.attr('href');
    const norm = normalizeUrl(href);
    if (!norm.ok) {
      skipped++;
      return;
    }
    if (Bookmark.getByUrl(norm.url)) {
      skipped++;
      return;
    }
    const title = a.text().trim() || norm.url;
    const date_added = unixToIso(a.attr('add_date')) || new Date().toISOString();

    const tagAttr = (a.attr('tags') || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const tags = [...new Set([...folderTags($, aEl), ...tagAttr])];

    const created = Bookmark.create({ url: norm.url, title, date_added, date_modified: date_added });
    if (tags.length) Tag.setForBookmark(created.id, tags);
    added++;
  });

  return { added, skipped };
}
