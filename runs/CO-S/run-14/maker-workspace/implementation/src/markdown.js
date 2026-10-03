/*
 * Safe, minimal Markdown renderer for notes (SCN-025).
 * Escapes all HTML first, then applies a small subset:
 *   # / ## / ###, **bold**, *italic*, `code`, ```code blocks```,
 *   - / * bullet lists, 1. numbered lists, > blockquotes,
 *   [text](http(s)://url) links.
 * Raw HTML is shown as text (never executed); only http/https links become
 * anchors. Text that is not Markdown renders as plain paragraphs.
 *
 * Shared module: Node (require) and browser (window.BMarkdown).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BMarkdown = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) {
    return (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inline(t) {
    t = esc(t);
    t = t.replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    // only http/https links become anchors; the href is already escaped by esc()
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return t;
  }

  function render(src) {
    const lines = (src || '').replace(/\r\n?/g, '\n').split('\n');
    let html = '';
    let i = 0;
    const special = /^(#{1,3})\s|^\s*[-*]\s|^\s*\d+\.\s|^\s*>|^\s*```/;
    while (i < lines.length) {
      const ln = lines[i];
      if (/^\s*```/.test(ln)) {
        const buf = []; i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(esc(lines[i])); i++; }
        i++;
        html += '<pre><code>' + buf.join('\n') + '</code></pre>';
        continue;
      }
      const h = ln.match(/^(#{1,3})\s+(.*)$/);
      if (h) { const n = h[1].length; html += '<h' + n + '>' + inline(h[2]) + '</h' + n + '>'; i++; continue; }
      if (/^\s*>\s?/.test(ln)) {
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(inline(lines[i].replace(/^\s*>\s?/, ''))); i++; }
        html += '<blockquote>' + buf.join('<br>') + '</blockquote>';
        continue;
      }
      if (/^\s*[-*]\s+/.test(ln)) {
        const buf = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { buf.push('<li>' + inline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>'); i++; }
        html += '<ul>' + buf.join('') + '</ul>';
        continue;
      }
      if (/^\s*\d+\.\s+/.test(ln)) {
        const buf = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { buf.push('<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'); i++; }
        html += '<ol>' + buf.join('') + '</ol>';
        continue;
      }
      if (/^\s*$/.test(ln)) { i++; continue; }
      const buf = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !special.test(lines[i])) { buf.push(inline(lines[i])); i++; }
      html += '<p>' + buf.join('<br>') + '</p>';
    }
    return html;
  }

  return { render, esc };
});
