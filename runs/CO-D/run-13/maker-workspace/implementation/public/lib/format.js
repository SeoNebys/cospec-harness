// Presentation helpers shared by browser (and unit-tested in Node):
// saved-time labels (SCN-012), safe note formatting (SCN-006), long-note test (SCN-011).
(function (root) {
  'use strict';

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function timeAgo(ms) {
    var s = ms / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return Math.floor(s / 86400) + ' d ago';
  }

  // Recent: relative; about a week or older: a date, with year when not the current year.
  function whenLabel(iso, now) {
    var d = new Date(iso);
    var nowMs = (now === undefined ? Date.now() : now);
    var days = (nowMs - d.getTime()) / 86400000;
    if (days < 7) return timeAgo(nowMs - d.getTime());
    var s = d.getDate() + ' ' + MON[d.getMonth()];
    if (d.getFullYear() !== new Date(nowMs).getFullYear()) s += ' ' + d.getFullYear();
    return s;
  }

  function isLongNote(t) {
    return !!t && (t.length > 240 || (t.match(/\n/g) || []).length > 4);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function inlineMd(s) {
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (m, txt, href) {
      return '<a href="' + href + '" target="_blank" rel="noopener">' + txt + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
    return s;
  }

  // A safe subset of Markdown: headings, bold/italic, links, unordered/ordered lists.
  function renderMarkdown(raw) {
    var text = escapeHtml(raw);
    var lines = text.split(/\r?\n/);
    var html = '', i = 0;
    function isH(l) { return /^#{1,3}\s+/.test(l); }
    function isUL(l) { return /^\s*[-*]\s+/.test(l); }
    function isOL(l) { return /^\s*\d+\.\s+/.test(l); }
    while (i < lines.length) {
      var line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }
      var h = /^(#{1,3})\s+(.*)$/.exec(line);
      if (h) { var lvl = h[1].length + 3; html += '<h' + lvl + '>' + inlineMd(h[2]) + '</h' + lvl + '>'; i++; continue; }
      if (isUL(line)) { html += '<ul>'; while (i < lines.length && isUL(lines[i])) { html += '<li>' + inlineMd(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>'; i++; } html += '</ul>'; continue; }
      if (isOL(line)) { html += '<ol>'; while (i < lines.length && isOL(lines[i])) { html += '<li>' + inlineMd(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'; i++; } html += '</ol>'; continue; }
      var para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !isH(lines[i]) && !isUL(lines[i]) && !isOL(lines[i])) { para.push(inlineMd(lines[i])); i++; }
      html += '<p>' + para.join('<br>') + '</p>';
    }
    return html;
  }

  // Highlight query terms in plain text (no regex; robust to any characters).
  function highlight(text, terms) {
    var raw = String(text == null ? '' : text);
    if (!terms || !terms.length) return escapeHtml(raw);
    var lower = raw.toLowerCase(), marks = [], n = raw.length, k;
    for (k = 0; k < n; k++) marks[k] = false;
    terms.forEach(function (t) {
      if (!t) return; var from = 0, idx;
      while ((idx = lower.indexOf(t, from)) >= 0) { for (var j = idx; j < idx + t.length; j++) marks[j] = true; from = idx + t.length; }
    });
    var out = '', i = 0;
    while (i < n) {
      if (marks[i]) { var a = i; while (i < n && marks[i]) i++; out += '<mark>' + escapeHtml(raw.slice(a, i)) + '</mark>'; }
      else { var b0 = i; while (i < n && !marks[i]) i++; out += escapeHtml(raw.slice(b0, i)); }
    }
    return out;
  }

  var api = { timeAgo: timeAgo, whenLabel: whenLabel, isLongNote: isLongNote, escapeHtml: escapeHtml, renderMarkdown: renderMarkdown, highlight: highlight };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Format = api;
})(typeof self !== 'undefined' ? self : this);
