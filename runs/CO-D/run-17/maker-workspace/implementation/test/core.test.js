"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const LL = require("../public/js/core.js");

test("SCN-002 normalizeUrl: shorthand accepted and normalised", () => {
  assert.deepEqual(LL.normalizeUrl("nytimes.com"), { ok: true, url: "https://nytimes.com/", domain: "nytimes.com" });
  assert.equal(LL.normalizeUrl("https://www.example.com/a").domain, "example.com");
});
test("SCN-002 normalizeUrl: malformed refused", () => {
  for (const bad of ["this is not a link", "notaurl", "ftp://x.com", "", "   "]) assert.equal(LL.normalizeUrl(bad).ok, false);
});

test("SCN-008 search: implicit AND across fields", () => {
  const items = [{ title: "How Deep-Sea Cables Run the Internet", description: "", url: "https://x", note: "", tags: [] }];
  const ast = LL.parseQuery("deep cables");
  assert.equal(LL.evalQuery(ast, items[0]), true);
  assert.equal(LL.evalQuery(LL.parseQuery("deep whales"), items[0]), false);
});
test("SCN-008 search: phrase, #tag, and/or/not case-insensitive, quotes literal", () => {
  const a = { title: "SQLite database engine", description: "", url: "https://github.com/sqlite", note: "rome notes", tags: ["code", "db"] };
  const b = { title: "Rome article", description: "", url: "https://x", note: "", tags: ["article"] };
  assert.equal(LL.evalQuery(LL.parseQuery('"database engine"'), a), true);
  assert.equal(LL.evalQuery(LL.parseQuery('"engine database"'), a), false);
  assert.equal(LL.evalQuery(LL.parseQuery("#code"), a), true);
  assert.equal(LL.evalQuery(LL.parseQuery("#code"), b), false);
  assert.equal(LL.evalQuery(LL.parseQuery("database NOT sqlite"), a), false);
  assert.equal(LL.evalQuery(LL.parseQuery("database and sqlite"), a), true);
  // grouping + or, case-insensitive operator
  assert.equal(LL.evalQuery(LL.parseQuery("rome (#article or #code)"), a), true);
  assert.equal(LL.evalQuery(LL.parseQuery("rome (#article or #code)"), b), true);
  // quoted word that IS an operator is treated as literal text (substring search)
  const c = { title: "editor or writer", description: "", url: "https://x", note: "", tags: [] };
  assert.equal(LL.evalQuery(LL.parseQuery('"or"'), c), true);      // literal 'or' found in "editor or writer"
  assert.equal(LL.evalQuery(LL.parseQuery('"or"'), a), false);     // no 'or' substring in item a
  // lowercase 'or' unquoted acts as the OR operator (union)
  assert.equal(LL.evalQuery(LL.parseQuery("sqlite or nomatchword"), a), true);
});
test("SCN-008 highlight terms exclude negated and operators", () => {
  const terms = LL.collectQueryTerms(LL.parseQuery("deep NOT whales #tag"), false, []);
  assert.ok(terms.includes("deep"));
  assert.ok(!terms.includes("whales"));
});

test("SCN-009 markdown renders safe subset", () => {
  const html = LL.markdownToHtml("**b** *i* `c`\n- one\n- two\n[x](https://e.com)");
  assert.match(html, /<strong>b<\/strong>/);
  assert.match(html, /<em>i<\/em>/);
  assert.match(html, /<li>one<\/li>/);
  assert.match(html, /<a href="https:\/\/e.com"/);
});
test("SCN-009 markdown blocks javascript: links", () => {
  const html = LL.markdownToHtml("[x](javascript:alert(1))");
  assert.doesNotMatch(html, /javascript:/);
});

test("SCN-014 bookmark export contains title, tags, date", () => {
  const html = LL.buildBookmarksHtml([{ url: "https://e.com/a", title: "A", tags: ["x", "y"], addedTs: 1500000000, description: "d" }]);
  assert.match(html, /<!DOCTYPE NETSCAPE-Bookmark-file-1>/);
  assert.match(html, /HREF="https:\/\/e.com\/a"/);
  assert.match(html, /ADD_DATE="1500000000"/);
  assert.match(html, /TAGS="x,y"/);
});
test("SCN-014 bookmark import: folders->tags, generic roots skipped, dates/tags kept", () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
    <DT><H3>Bookmarks bar</H3><DL><p>
      <DT><H3>Work</H3><DL><p>
        <DT><H3>Research</H3><DL><p>
          <DT><A HREF="https://e.org/p" ADD_DATE="1500000000" TAGS="pdf">Paper</A>
        </DL><p>
      </DL><p>
    </DL><p></DL><p>`;
  const rows = LL.parseBookmarksHtml(html);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].href, "https://e.org/p");
  assert.equal(rows[0].title, "Paper");
  assert.deepEqual(rows[0].tags.sort(), ["pdf", "research", "work"]);
  assert.ok(!rows[0].tags.includes("bookmarks bar"));
  assert.equal(LL.normalizeAddDate(rows[0].addDate), 1500000000);
});
