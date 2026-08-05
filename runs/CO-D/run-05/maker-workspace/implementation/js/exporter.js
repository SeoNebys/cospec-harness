// Writes the whole collection back out as a standard browser bookmarks file
// (SCN-016). The point is that the client's FILING survives the move: labels are
// written as folders (a multi-label link appears under each), and personal notes
// ride along as <DD> descriptions. Round-trips back through importer.

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function linkLine(it, indent) {
  const ad = it.savedAt ? ` ADD_DATE="${Math.floor(it.savedAt / 1000)}"` : "";
  let s = `${indent}<DT><A HREF="${esc(it.url)}"${ad}>${esc(it.title)}</A>\n`;
  if (it.note) s += `${indent}<DD>${esc(it.note)}\n`;
  return s;
}

// Includes put-away links too — "take my WHOLE collection" (nothing silently dropped).
export function buildBookmarksHtml(items) {
  const byLabel = new Map();
  const unlabelled = [];
  for (const it of items) {
    if (it.labels && it.labels.length) {
      for (const l of it.labels) {
        if (!byLabel.has(l)) byLabel.set(l, []);
        byLabel.get(l).push(it);
      }
    } else {
      unlabelled.push(it);
    }
  }
  let html =
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n" +
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n' +
    "<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n";
  for (const label of [...byLabel.keys()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))) {
    html += `  <DT><H3>${esc(label)}</H3>\n  <DL><p>\n`;
    for (const it of byLabel.get(label)) html += linkLine(it, "    ");
    html += "  </DL><p>\n";
  }
  for (const it of unlabelled) html += linkLine(it, "  ");
  html += "</DL><p>\n";
  return html;
}
