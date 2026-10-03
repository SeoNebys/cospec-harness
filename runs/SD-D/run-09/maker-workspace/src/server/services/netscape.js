import * as cheerio from 'cheerio';

// Netscape Bookmark File Format import/export (research Decision 8, FR-026/028).
// Folders (<H3>) map to tags; <A HREF ... ADD_DATE> carry title/url/date.

// Parse → [{ url, title, tags: [], dateAdded (ISO) }]
export function parseNetscape(html) {
  const $ = cheerio.load(html);
  const results = [];

  // Walk each anchor, deriving its folder path from ancestor <DL>/<DT><H3>.
  $('a').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href');
    if (!href || !/^https?:/i.test(href)) return;
    const title = $a.text().trim() || href;
    const addDate = $a.attr('add_date');
    const dateAdded = addDate
      ? new Date(Number(addDate) * 1000).toISOString()
      : new Date().toISOString();
    const tags = folderPath($, el);
    results.push({ url: href, title, tags, dateAdded });
  });

  return results;
}

// Determine folder names enclosing this anchor by walking up the DL/DT structure.
function folderPath($, el) {
  const tags = [];
  let node = el.parent;
  while (node) {
    if (node.name === 'dl') {
      // The <H3> heading is typically the previous <DT> sibling of this <DL>.
      const $dl = $(node);
      const $prevH3 = $dl.prevAll('h3').first();
      const name = $prevH3.text().trim();
      if (name) tags.unshift(name);
      // Also handle <DT><H3>..</H3><DL>..</DL> nesting where H3 is a sibling within parent DT.
      const $parentDt = $dl.parent();
      if ($parentDt && $parentDt.get(0) && $parentDt.get(0).name === 'dt') {
        const $h3 = $parentDt.children('h3').first();
        const n2 = $h3.text().trim();
        if (n2 && !tags.includes(n2)) tags.unshift(n2);
      }
    }
    node = node.parent;
  }
  // De-dupe while preserving order.
  return [...new Set(tags.filter(Boolean))];
}

// Serialize bookmarks → Netscape HTML. Tags render as folders (one folder per
// tag; a bookmark appears under each of its tags, or under the root if untagged).
export function serializeNetscape(bookmarks) {
  const escape = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const epoch = (iso) => Math.floor(new Date(iso).getTime() / 1000) || '';

  // Group by tag; collect untagged separately.
  const byTag = new Map();
  const untagged = [];
  for (const b of bookmarks) {
    if (b.tags && b.tags.length) {
      for (const t of b.tags) {
        if (!byTag.has(t)) byTag.set(t, []);
        byTag.get(t).push(b);
      }
    } else {
      untagged.push(b);
    }
  }

  const lines = [];
  lines.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
  lines.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">');
  lines.push('<TITLE>Bookmarks</TITLE>');
  lines.push('<H1>Bookmarks</H1>');
  lines.push('<DL><p>');

  const anchor = (b) =>
    `        <DT><A HREF="${escape(b.url)}" ADD_DATE="${epoch(b.dateAdded)}">${escape(
      b.title
    )}</A>`;

  for (const [tag, items] of byTag) {
    lines.push(`    <DT><H3>${escape(tag)}</H3>`);
    lines.push('    <DL><p>');
    for (const b of items) lines.push(anchor(b));
    lines.push('    </DL><p>');
  }
  for (const b of untagged) {
    lines.push(`    <DT><A HREF="${escape(b.url)}" ADD_DATE="${epoch(b.dateAdded)}">${escape(
      b.title
    )}</A>`);
  }

  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}
