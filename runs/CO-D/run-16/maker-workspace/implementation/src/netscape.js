// Import/export of the standard Netscape browser-bookmarks HTML format.
// Basis: SCN-023 (keep titles, tags, original saved dates; standard format).

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

// Build a standard bookmarks file. ADD_DATE is unix seconds; TAGS is a
// comma-separated attribute; description follows as a <DD>. Basis: SCN-023.
export function exportNetscape(items) {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const b of items) {
    const add = Math.floor((b.added || Date.now()) / 1000);
    let attrs = `HREF="${escHtml(b.url)}" ADD_DATE="${add}"`;
    if (b.tags && b.tags.length) attrs += ` TAGS="${escHtml(b.tags.join(','))}"`;
    lines.push(`    <DT><A ${attrs}>${escHtml(b.title || b.url)}</A>`);
    if (b.description) lines.push(`    <DD>${escHtml(b.description)}`);
  }
  lines.push('</DL><p>');
  return lines.join('\n');
}

// Parse a bookmarks file into plain records. Tags come from the TAGS attribute;
// original saved date from ADD_DATE (seconds). A following <DD> becomes the
// description. Basis: SCN-023.
export function parseNetscape(html) {
  const out = [];
  const anchorRe = /<DT>\s*<A\s+([^>]*)>([\s\S]*?)<\/A>\s*(?:<DD>([\s\S]*?)(?=<DT|<\/DL|<DL|$))?/gi;
  let m;
  while ((m = anchorRe.exec(html))) {
    const attrs = m[1];
    const title = decodeEntities(stripTags(m[2]).trim());
    const desc = m[3] ? decodeEntities(stripTags(m[3]).trim()) : '';
    const href = attr(attrs, 'HREF');
    if (!href) continue;
    const addRaw = attr(attrs, 'ADD_DATE');
    const tagsRaw = attr(attrs, 'TAGS');
    out.push({
      url: href,
      title: title || href,
      description: desc,
      tags: tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [],
      added: addRaw ? parseInt(addRaw, 10) * 1000 : null,
    });
  }
  return out;
}

function attr(attrs, name) {
  const re = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i');
  const m = attrs.match(re);
  return m ? decodeEntities(m[1]) : '';
}
function stripTags(s) { return String(s).replace(/<[^>]*>/g, ''); }
function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
