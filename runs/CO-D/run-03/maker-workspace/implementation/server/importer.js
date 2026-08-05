'use strict';
// Parse a bookmarks file into a flat list of items to move in (SCN-020).
// Supports the standard Netscape bookmarks HTML that browsers export, and this
// app's own JSON export (for round-trips). Folders become labels; the original
// saved date (ADD_DATE) is preserved so years of history survive.

// Parse Netscape bookmark HTML. Returns [{title, url, folder, date}] where
// folder is a "Parent/Child" path (nested folders → multiple labels later) and
// date is an ISO date string (from ADD_DATE seconds) or null.
function parseNetscape(html) {
  const items = [];
  const stack = []; // folder-name stack
  // Walk the document token by token: <H3> opens a folder, </DL> closes one, <A> is a link.
  const tokenRe = /<h3[^>]*>([\s\S]*?)<\/h3>|<\/dl>|<a\s+([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = tokenRe.exec(html)) !== null) {
    if (m[1] !== undefined) {
      // folder heading
      stack.push(stripTags(m[1]).trim());
    } else if (/^<\/dl>/i.test(m[0])) {
      if (stack.length) stack.pop();
    } else if (m[2] !== undefined) {
      const attrs = m[2];
      const href = attr(attrs, 'href');
      if (!href || /^javascript:/i.test(href) || /^place:/i.test(href)) continue;
      const title = stripTags(m[3]).trim();
      const addDate = attr(attrs, 'add_date');
      items.push({
        title,
        url: href,
        folder: stack.length ? stack.join('/') : null,
        date: addDateToIso(addDate),
      });
    }
  }
  return items;
}

function attr(attrs, name) {
  const re = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i');
  const m = attrs.match(re);
  return m ? decodeEntities(m[1]) : null;
}

function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]+>/g, ''));
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function addDateToIso(addDate) {
  if (!addDate) return null;
  const secs = parseInt(addDate, 10);
  if (!Number.isFinite(secs) || secs <= 0) return null;
  // ADD_DATE is seconds since epoch (some very old files use larger/odd values; guard).
  const ms = secs > 1e12 ? secs : secs * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Turn a "Parent/Child" folder path into lowercased labels (SCN-020, SCN-007 style).
function foldersToLabels(folder) {
  if (!folder) return [];
  return folder.split('/').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// Detect and parse this app's own JSON export; returns null if not ours.
function parseOwnExport(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { return null; }
  if (!obj || !Array.isArray(obj.bookmarks)) return null;
  return obj.bookmarks.map((b) => ({
    title: b.title || '',
    url: b.url,
    folder: null,
    labels: Array.isArray(b.labels) ? b.labels : [],
    date: b.savedAt || null,
    _full: b, // full record (keeps labels/copy/dates on round-trip)
  }));
}

// Parse either format. Returns {kind, items}.
function parseBookmarks(text) {
  const own = parseOwnExport(text);
  if (own) return { kind: 'own', items: own };
  return { kind: 'netscape', items: parseNetscape(text) };
}

module.exports = { parseNetscape, parseOwnExport, parseBookmarks, foldersToLabels, addDateToIso };
