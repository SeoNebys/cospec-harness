// Minimal, safe Markdown renderer for private notes (SCN-003).
// Supported subset: bold **..**, italic *..*, inline code `..`, links
// [text](http(s)://..), and bullet lists (lines starting with - or *).
// Untrusted text is HTML-escaped BEFORE any formatting is applied, so notes
// can never inject markup (see non-functional-backlog note on note safety).

export function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function inline(text) {
  // text is raw (unescaped) here; escape first, then apply formatting on the
  // escaped string using patterns that only match the original punctuation.
  let out = escapeHtml(text);
  // Links: [label](http(s)://url) — url must not contain spaces or quotes.
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}

export function renderMarkdown(src) {
  const lines = String(src == null ? "" : src).split(/\r?\n/);
  let html = "";
  let inList = false;
  for (const line of lines) {
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`;
    } else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      if (line.trim() !== "") html += `<div>${inline(line)}</div>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}
