// Import/export (SCN-015). Pure functions, unit-testable.
// - parseBookmarksHtml: read a browser's exported bookmarks (Netscape format),
//   preserving each bookmark's ORIGINAL add-date and its folder.
// - buildNetscapeHtml: universal bookmarks file (opens in any browser).
// - buildBackup / importDate: full JSON backup + date handling.

function decode(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Returns [{ url, title, addDate (ms|0), folder }]
export function parseBookmarksHtml(html) {
  const out = [];
  const stack = []; // folder names of enclosing <DL>s
  let pending = null; // folder from the most recent <H3>, applies to the next <DL>
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>|<dl[^>]*>|<\/dl>|<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1] !== undefined) { pending = decode(m[1]); continue; }        // <H3>folder</H3>
    const tok = m[0].toLowerCase();
    if (tok.startsWith('<dl')) { stack.push(pending); pending = null; continue; }
    if (tok.startsWith('</dl')) { stack.pop(); continue; }
    // <A ...>title</A>
    const attrs = m[2] || '';
    const href = (attrs.match(/href=["']([^"']+)["']/i) || [])[1];
    if (!href || !/^https?:/i.test(href)) continue;
    const add = (attrs.match(/add_date=["']?(\d+)["']?/i) || [])[1];
    const folder = [...stack].reverse().find((f) => f) || '';
    out.push({ url: href, title: decode(m[3]) || '', addDate: add ? Number(add) * 1000 : 0, folder });
  }
  return out;
}

// SCN-015: imported links keep their real date; today only as a fallback.
export function importDate(addDateMs, now) {
  return addDateMs && addDateMs > 0 ? addDateMs : now;
}

export function buildNetscapeHtml(links) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rows = links.map((l) => {
    const d = Math.floor((l.savedAt || 0) / 1000);
    return `    <DT><A HREF="${esc(l.url)}"${d ? ` ADD_DATE="${d}"` : ''}>${esc(l.title || l.url)}</A>`;
  }).join('\n');
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>My Links</H1>\n<DL><p>\n${rows}\n</DL><p>\n`;
}

// Full backup: everything that defines the library. Readable copies (text) are
// included; large binary PDF copies are omitted (noted to the client).
export function buildBackup(links, searches, readableCopies) {
  return JSON.stringify({
    app: 'my-links', version: 1, exportedAt: null,
    links, searches: searches || [], copies: readableCopies || [],
  }, null, 2);
}
