// Note formatting (SCN-014): headings, bold, italic, inline code, bulleted and
// numbered lists, block quotes, links. Input is escaped first so pasted markup is
// shown as text and never executed.

export function escapeHtml(s) {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function inline(raw) {
  let s = escapeHtml(raw);
  s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}

export function renderNote(md) {
  let html = "";
  let block = null; // "ul" | "ol" | "quote"
  const close = () => {
    if (block === "ul") html += "</ul>";
    else if (block === "ol") html += "</ol>";
    else if (block === "quote") html += "</blockquote>";
    block = null;
  };
  for (const ln of (md || "").split(/\r?\n/)) {
    let m;
    if ((m = ln.match(/^(#{1,3})\s+(.*)/))) { close(); const lvl = m[1].length + 3; html += `<h${lvl} class="note-h">` + inline(m[2]) + `</h${lvl}>`; continue; }
    if ((m = ln.match(/^\s*[-*]\s+(.*)/))) { if (block !== "ul") { close(); html += "<ul>"; block = "ul"; } html += "<li>" + inline(m[1]) + "</li>"; continue; }
    if ((m = ln.match(/^\s*\d+\.\s+(.*)/))) { if (block !== "ol") { close(); html += "<ol>"; block = "ol"; } html += "<li>" + inline(m[1]) + "</li>"; continue; }
    if ((m = ln.match(/^>\s?(.*)/))) { if (block !== "quote") { close(); html += "<blockquote>"; block = "quote"; } html += "<div>" + inline(m[1]) + "</div>"; continue; }
    close();
    if (ln.trim() === "") continue;
    html += "<div>" + inline(ln) + "</div>";
  }
  close();
  return html;
}
