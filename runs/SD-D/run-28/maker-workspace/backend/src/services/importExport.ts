import * as cheerio from 'cheerio';
import type { DB } from '../db/db.ts';
import { normalizeUrl } from '../lib/url.ts';
import { create, findByKey, serialize } from '../models/bookmark.ts';
import { getBookmarkTags, setBookmarkTags } from '../models/tag.ts';

export interface ImportResult {
  imported: number;
  merged: number;
  skipped: number;
  newIds: { id: string; url: string }[];
}

interface ParsedBookmark {
  url: string;
  title: string;
  tags: string[];
  addDate?: string; // ISO
}

function epochToIso(addDate: string | undefined): string | undefined {
  if (!addDate) return undefined;
  const n = Number(addDate);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  // Netscape ADD_DATE is seconds since epoch.
  return new Date(n * 1000).toISOString();
}

/** Parse a Netscape bookmark HTML file into a flat list (FR-024). */
export function parseNetscape(html: string): ParsedBookmark[] {
  const $ = cheerio.load(html);
  const out: ParsedBookmark[] = [];
  // Walk H3 (folder headings) and A (links) in document order so each link can
  // fall back to the most recent enclosing folder name when it has no TAGS attr.
  let currentFolder = '';
  $('h3, a').each((_, el) => {
    if (el.tagName && el.tagName.toLowerCase() === 'h3') {
      currentFolder = $(el).text().trim();
      return;
    }
    const $a = $(el);
    const href = $a.attr('href');
    if (!href) return;
    if (!/^https?:\/\//i.test(href) && !/^[\w.-]+\.[a-z]{2,}/i.test(href)) return;

    const tagsAttr = $a.attr('tags');
    let tags = tagsAttr
      ? tagsAttr
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    if (tags.length === 0 && currentFolder) tags = [currentFolder];

    out.push({
      url: href,
      title: ($a.text() || '').trim(),
      tags,
      addDate: epochToIso($a.attr('add_date')),
    });
  });
  return out;
}

/** Import, merging entries whose normalized address already exists (SC-006). */
export function importBookmarks(
  db: DB,
  html: string,
  enqueue: (job: { id: string; url: string }) => void,
): ImportResult {
  const parsed = parseNetscape(html);
  const result: ImportResult = { imported: 0, merged: 0, skipped: 0, newIds: [] };

  for (const item of parsed) {
    let key: string;
    try {
      key = normalizeUrl(item.url).key;
    } catch {
      result.skipped++;
      continue;
    }
    const existing = findByKey(db, key);
    if (existing) {
      // Merge: union tags, keep existing title/date.
      const union = Array.from(new Set([...getBookmarkTags(db, existing.id), ...item.tags]));
      setBookmarkTags(db, existing.id, union);
      result.merged++;
      continue;
    }
    try {
      const created = create(db, {
        url: item.url,
        title: item.title || undefined,
        tags: item.tags,
        dateAdded: item.addDate,
      });
      result.imported++;
      result.newIds.push({ id: created.id, url: created.url });
      enqueue({ id: created.id, url: created.url });
    } catch {
      result.skipped++;
    }
  }
  return result;
}

/** Build a Netscape bookmark HTML export (FR-025). */
export function exportBookmarks(db: DB): string {
  const rows = db
    .prepare('SELECT rowid, * FROM bookmark ORDER BY date_added ASC')
    .all() as { id: string; rowid: number }[];
  const lines: string[] = [];
  lines.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
  lines.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">');
  lines.push('<TITLE>Bookmarks</TITLE>');
  lines.push('<H1>Bookmarks</H1>');
  lines.push('<DL><p>');
  for (const r of rows) {
    const b = serialize(db, r as never);
    const addSecs = Math.floor(new Date(b.dateAdded).getTime() / 1000);
    const tagsAttr = b.tags.length ? ` TAGS="${escapeAttr(b.tags.join(','))}"` : '';
    lines.push(
      `    <DT><A HREF="${escapeAttr(b.url)}" ADD_DATE="${addSecs}"${tagsAttr}>${escapeHtml(
        b.title,
      )}</A>`,
    );
  }
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
