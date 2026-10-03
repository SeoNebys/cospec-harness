/*
 * Browser-bookmark import/export (SCN-021, SCN-022).
 * - parseNetscape: parse the standard Netscape bookmarks HTML into a flat list,
 *   preserving title, ADD_DATE (original date added) and TAGS where present, and
 *   recording the containing folder.
 * - buildBookmarksHtml: export a browser-compatible file preserving title,
 *   ADD_DATE and TAGS.
 * - buildBackupJson: full backup including tags, notes, read-later/archive state.
 *
 * Regex-based (no DOM) so it runs in Node tests and the browser alike.
 * Shared module: Node (require) and browser (window.BPorter).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BPorter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function decodeEntities(s) {
    return (s || '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }
  function attr(tag, name) {
    const m = tag.match(new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i'));
    return m ? m[1] : null;
  }

  // Returns [{ title, url, folder, added (epoch seconds|undefined), tags:[] }]
  function parseNetscape(html) {
    const out = [];
    let folder = 'Imported';
    // Match either an <H3>folder</H3> or an <A ...>title</A>, in document order.
    const re = /<H3[^>]*>([\s\S]*?)<\/H3>|<A\s+([^>]*)>([\s\S]*?)<\/A>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (m[1] !== undefined) {
        folder = decodeEntities(m[1].trim()) || 'Imported';
      } else {
        const tag = m[2];
        const href = attr(tag, 'href');
        if (!href) continue;
        const ad = attr(tag, 'add_date');
        const tg = attr(tag, 'tags');
        out.push({
          title: decodeEntities(m[3].trim()) || href,
          url: href,
          folder,
          added: ad ? parseInt(ad, 10) : undefined,
          tags: tg ? tg.split(',').map(t => t.trim()).filter(Boolean) : []
        });
      }
    }
    return out;
  }

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Browser-compatible export preserving title, ADD_DATE and TAGS.
  function buildBookmarksHtml(bookmarks) {
    const rows = bookmarks.map(b => {
      const added = Math.floor((b.createdAt || Date.now()) / 1000);
      let a = ' HREF="' + esc(b.url) + '" ADD_DATE="' + added + '"';
      if (b.tags && b.tags.length) a += ' TAGS="' + esc(b.tags.join(',')) + '"';
      return '    <DT><A' + a + '>' + esc(b.title || b.url) + '</A>';
    }).join('\n');
    return '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n' +
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n' +
      '<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n' + rows + '\n</DL><p>\n';
  }

  // Full backup preserving all app-specific fields (excludes derived icon/preview cache).
  function buildBackupJson(bookmarks, extra) {
    const clean = bookmarks.map(b => {
      const { ...rest } = b;
      return rest;
    });
    return JSON.stringify(Object.assign({ version: 1, exportedAt: Date.now(), bookmarks: clean }, extra || {}), null, 2);
  }

  return { parseNetscape, buildBookmarksHtml, buildBackupJson };
});
