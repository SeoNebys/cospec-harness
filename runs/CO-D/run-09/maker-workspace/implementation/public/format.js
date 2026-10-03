/*
 * Note formatting (SCN-019): headings, bold, italic, bullet & numbered lists,
 * inline code, links. Lightweight, safe (input is escaped before formatting).
 * Shared by the browser (window.BMFormat) and Node tests (module.exports).
 */
(function (root) {
  function esc(s) {
    return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }
  function inline(t) {
    t = esc(t);
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    return t;
  }
  function render(md) {
    if (!md) return "";
    const lines = String(md).split(/\r?\n/);
    const out = [];
    let listType = null;
    const closeList = () => { if (listType) { out.push(listType === "ol" ? "</ol>" : "</ul>"); listType = null; } };
    for (const ln of lines) {
      if (/^\s*##\s+/.test(ln)) { closeList(); out.push("<h4>" + inline(ln.replace(/^\s*##\s+/, "")) + "</h4>"); }
      else if (/^\s*#\s+/.test(ln)) { closeList(); out.push("<h3>" + inline(ln.replace(/^\s*#\s+/, "")) + "</h3>"); }
      else if (/^\s*-\s+/.test(ln)) { if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; } out.push("<li>" + inline(ln.replace(/^\s*-\s+/, "")) + "</li>"); }
      else if (/^\s*\d+\.\s+/.test(ln)) { if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; } out.push("<li>" + inline(ln.replace(/^\s*\d+\.\s+/, "")) + "</li>"); }
      else { closeList(); if (ln.trim() !== "") out.push("<div>" + inline(ln) + "</div>"); }
    }
    closeList();
    return out.join("");
  }
  const api = { render, esc };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.BMFormat = api;
})(typeof window !== "undefined" ? window : null);
