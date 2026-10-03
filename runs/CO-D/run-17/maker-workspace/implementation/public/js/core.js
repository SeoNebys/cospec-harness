/*
 * core.js — pure, framework-free logic shared by the browser app and Node tests.
 * Dual-exported: `module.exports` under Node, global `LL` in the browser.
 * Implements behaviour from SCN-002 (address rules), SCN-008 (search grammar),
 * SCN-009 (markdown note), SCN-014 (bookmark import/export).
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.LL = Object.assign(root.LL || {}, factory());
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // ---------- HTML escaping ----------
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function escapeAttr(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function decodeEntities(s) {
    return String(s == null ? "" : s)
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(parseInt(n, 10)));
  }

  // ---------- Address normalisation (SCN-002) ----------
  function normalizeUrl(raw) {
    raw = (raw == null ? "" : String(raw)).trim();
    if (!raw || /\s/.test(raw)) return { ok: false };
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : "https://" + raw;
    let u;
    try { u = new URL(withScheme); } catch (e) { return { ok: false }; }
    if (!/^https?:$/.test(u.protocol)) return { ok: false };
    if (!u.hostname.includes(".") || u.hostname.split(".").some(p => p.length === 0)) return { ok: false };
    return { ok: true, url: u.href, domain: u.hostname.replace(/^www\./, "") };
  }

  // ---------- Dates ----------
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function formatDate(ts) {
    const d = new Date(ts * 1000);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  // ---------- Search query grammar (SCN-008) ----------
  // OR (lowest) > AND (implicit) > NOT > primary. Operators are case-insensitive;
  // quote a word to search it literally. Terms: word, "phrase", #tag, ( ).
  function tokenizeQuery(q) {
    const toks = []; let i = 0; q = String(q || "");
    while (i < q.length) {
      const ch = q[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === "(") { toks.push({ t: "(" }); i++; continue; }
      if (ch === ")") { toks.push({ t: ")" }); i++; continue; }
      if (ch === '"') { let j = i + 1, s = ""; while (j < q.length && q[j] !== '"') { s += q[j]; j++; } i = j < q.length ? j + 1 : j; toks.push({ t: "phrase", v: s }); continue; }
      if (ch === "#") { let j = i + 1, s = ""; while (j < q.length && !/[\s()"]/.test(q[j])) { s += q[j]; j++; } i = j; if (s) toks.push({ t: "tag", v: s }); else toks.push({ t: "word", v: "#" }); continue; }
      let j = i, s = ""; while (j < q.length && !/[\s()"]/.test(q[j])) { s += q[j]; j++; } i = j;
      if (/^(and|or|not)$/i.test(s)) toks.push({ t: s.toUpperCase() }); else toks.push({ t: "word", v: s });
    }
    return toks;
  }
  function parseQuery(q) {
    const toks = tokenizeQuery(q); let pos = 0;
    const peek = () => toks[pos]; const next = () => toks[pos++];
    function parseExpr() { return parseOr(); }
    function parseOr() { let n = parseAnd(); while (peek() && peek().t === "OR") { next(); n = { op: "or", l: n, r: parseAnd() }; } return n; }
    function parseAnd() {
      let n = parseNot();
      while (true) { const p = peek(); if (!p || p.t === "OR" || p.t === ")") break; if (p.t === "AND") next(); const r = parseNot(); if (r == null) break; n = n == null ? r : { op: "and", l: n, r }; }
      return n;
    }
    function parseNot() { if (peek() && peek().t === "NOT") { next(); return { op: "not", c: parseNot() }; } return parsePrimary(); }
    function parsePrimary() {
      const p = peek(); if (!p) return null;
      if (p.t === "(") { next(); const e = parseExpr(); if (peek() && peek().t === ")") next(); return e; }
      if (p.t === "word") { next(); return { op: "word", v: p.v }; }
      if (p.t === "phrase") { next(); return { op: "phrase", v: p.v }; }
      if (p.t === "tag") { next(); return { op: "tag", v: p.v }; }
      next(); return null;
    }
    try { return parseExpr(); } catch (e) { return null; }
  }
  function itemSearchText(it) {
    return [it.title, it.description, it.url, it.note].map(x => x || "").join(" ").toLowerCase();
  }
  function evalQuery(node, it) {
    if (!node) return true;
    switch (node.op) {
      case "word": return itemSearchText(it).includes((node.v || "").toLowerCase());
      case "phrase": return itemSearchText(it).includes((node.v || "").toLowerCase());
      case "tag": return (it.tags || []).some(t => t.toLowerCase() === (node.v || "").toLowerCase());
      case "and": return evalQuery(node.l, it) && evalQuery(node.r, it);
      case "or": return evalQuery(node.l, it) || evalQuery(node.r, it);
      case "not": return !evalQuery(node.c, it);
    }
    return true;
  }
  function collectQueryTerms(node, neg, acc) {
    acc = acc || [];
    if (!node) return acc;
    if (node.op === "word" || node.op === "phrase") { if (!neg && node.v) acc.push(node.v); }
    else if (node.op === "and" || node.op === "or") { collectQueryTerms(node.l, neg, acc); collectQueryTerms(node.r, neg, acc); }
    else if (node.op === "not") collectQueryTerms(node.c, !neg, acc);
    return acc;
  }

  // ---------- Markdown note (SCN-009) — safe subset ----------
  function mdInline(s) {
    s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => {
      const safe = /^(https?:|mailto:)/i.test(url) ? url : "#";
      return `<a href="${escapeAttr(safe)}" target="_blank" rel="noopener">${txt}</a>`;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>").replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
    return s;
  }
  function markdownToHtml(src) {
    const lines = escapeHtml(src).split(/\r?\n/); let html = ""; let inList = false;
    const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
    for (const raw of lines) {
      const line = raw.trim();
      if (line === "") { closeList(); continue; }
      let m;
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { closeList(); const lvl = m[1].length + 2; html += `<h${lvl}>${mdInline(m[2])}</h${lvl}>`; continue; }
      if ((m = line.match(/^[-*]\s+(.*)$/))) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${mdInline(m[1])}</li>`; continue; }
      if ((m = line.match(/^>\s+(.*)$/))) { closeList(); html += `<blockquote>${mdInline(m[1])}</blockquote>`; continue; }
      closeList(); html += `<p>${mdInline(line)}</p>`;
    }
    closeList(); return html;
  }

  // ---------- Bookmark import / export (SCN-014) ----------
  const GENERIC_FOLDERS = new Set(["bookmarks", "bookmarks bar", "bookmarks menu", "bookmarks toolbar", "other bookmarks", "favorites bar", "favorites", "mobile bookmarks"]);
  function parseBookmarksHtml(html) {
    html = String(html || "");
    const re = /<h3[^>]*>([\s\S]*?)<\/h3>|<dl\b[^>]*>|<\/dl>|<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    const out = []; const stack = []; let pendingFolder = null; let m;
    while ((m = re.exec(html))) {
      if (m[1] !== undefined) { pendingFolder = decodeEntities(m[1]).trim(); }
      else if (/^<dl/i.test(m[0])) { stack.push(pendingFolder); pendingFolder = null; }
      else if (/^<\/dl/i.test(m[0])) { stack.pop(); }
      else {
        const attrs = m[2] || "";
        const href = (attrs.match(/href\s*=\s*"([^"]*)"/i) || attrs.match(/href\s*=\s*'([^']*)'/i) || [])[1] || "";
        const addDateRaw = (attrs.match(/add_date\s*=\s*"([^"]*)"/i) || [])[1];
        const tagsAttr = (attrs.match(/tags\s*=\s*"([^"]*)"/i) || [])[1] || "";
        const title = decodeEntities(m[3]).trim();
        const folderTags = stack.filter(Boolean).map(s => s.toLowerCase()).filter(f => !GENERIC_FOLDERS.has(f));
        const attrTags = tagsAttr.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
        out.push({ href, title, addDate: addDateRaw, tags: uniq([...folderTags, ...attrTags]) });
      }
    }
    return out;
  }
  function uniq(arr) { return [...new Set(arr)]; }
  function buildBookmarksHtml(links) {
    const lines = ["<!DOCTYPE NETSCAPE-Bookmark-file-1>",
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      "<TITLE>Bookmarks</TITLE>", "<H1>My Link Library</H1>", "<DL><p>"];
    for (const it of links) {
      const tags = (it.tags || []).join(",");
      let a = `    <DT><A HREF="${escapeAttr(it.url)}" ADD_DATE="${it.addedTs || Math.floor(Date.now() / 1000)}"` + (tags ? ` TAGS="${escapeAttr(tags)}"` : "") + `>${escapeHtml(it.title)}</A>`;
      lines.push(a);
      if (it.description) lines.push(`    <DD>${escapeHtml(it.description)}`);
    }
    lines.push("</DL><p>");
    return lines.join("\n");
  }
  function normalizeAddDate(raw) {
    const ad = parseInt(raw, 10);
    if (!Number.isFinite(ad) || ad <= 0) return null;
    return ad > 1e12 ? Math.floor(ad / 1000) : ad; // tolerate ms
  }

  return {
    escapeHtml, escapeAttr, decodeEntities,
    normalizeUrl, formatDate,
    tokenizeQuery, parseQuery, evalQuery, collectQueryTerms, itemSearchText,
    markdownToHtml,
    parseBookmarksHtml, buildBookmarksHtml, normalizeAddDate, GENERIC_FOLDERS,
  };
});
