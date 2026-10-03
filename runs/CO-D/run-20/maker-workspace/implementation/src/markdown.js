// Minimal, safe Markdown for notes (SCN-009). Input is treated as text and
// escaped first, so raw HTML/scripts are shown literally, never executed.
// Supports headings, unordered/ordered lists, links, bold/italic, inline code.

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function inline(escaped) {
  let s = escaped;
  s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) =>
    /^(https?:|mailto:|\/)/i.test(url) ? `<a href="${url}" target="_blank" rel="noopener">${text}</a>` : m);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?]|$)/g, '$1<em>$2</em>');
  return s;
}

export function renderMarkdown(src) {
  const lines = escapeHtml(src).split(/\r?\n/);
  const isUL = (l) => /^\s*[-*]\s+/.test(l);
  const isOL = (l) => /^\s*\d+\.\s+/.test(l);
  const isH = (l) => /^#{1,3}\s+/.test(l);
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = Math.min(h[1].length + 2, 4);
      html += `<h${level}>${inline(h[2])}</h${level}>`;
      i++; continue;
    }
    if (isUL(line)) {
      html += '<ul>';
      while (i < lines.length && isUL(lines[i])) { html += `<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`; i++; }
      html += '</ul>'; continue;
    }
    if (isOL(line)) {
      html += '<ol>';
      while (i < lines.length && isOL(lines[i])) { html += `<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`; i++; }
      html += '</ol>'; continue;
    }
    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !isH(lines[i]) && !isUL(lines[i]) && !isOL(lines[i])) {
      para.push(lines[i]); i++;
    }
    html += `<p>${para.map(inline).join('<br>')}</p>`;
  }
  return html;
}
