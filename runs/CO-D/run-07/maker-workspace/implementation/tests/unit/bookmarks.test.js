import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNetscape, buildNetscape } from "../../src/bookmarks.js";

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Reading</H3>
  <DL><p>
    <DT><A HREF="https://example.com/great-article" ADD_DATE="1717200000">A Great Article</A>
    <DT><A HREF="https://www.nasa.gov/webb/" ADD_DATE="1716000000">NASA Webb</A>
  </DL><p>
  <DT><H3>Recipes</H3>
  <DL><p>
    <DT><A HREF="https://recipes.example.com/tacos" ADD_DATE="1715000000">Best Tacos</A>
  </DL><p>
</DL><p>`;

test("import maps folders to tags and preserves dates (SCN-016)", () => {
  const items = parseNetscape(SAMPLE);
  assert.equal(items.length, 3);
  const tacos = items.find((i) => i.title === "Best Tacos");
  assert.deepEqual(tacos.tags, ["recipes"]);
  assert.equal(tacos.addDate, 1715000000);
  const article = items.find((i) => i.title === "A Great Article");
  assert.deepEqual(article.tags, ["reading"]);
});

test("export is standard format preserving titles/tags/dates + app fields", () => {
  const items = [
    { url: "https://a.com/x", title: "X & Y", tags: ["t1", "t2"], ts: 1710000000000, status: "finished", archived: true, note: "hi <there>" },
  ];
  const html = buildNetscape(items);
  assert.match(html, /NETSCAPE-Bookmark-file-1/);
  assert.match(html, /HREF="https:\/\/a\.com\/x"/);
  assert.match(html, /ADD_DATE="1710000000"/);
  assert.match(html, /TAGS="t1,t2"/);
  assert.match(html, /STATUS="finished"/);
  assert.match(html, /ARCHIVED="1"/);
  assert.match(html, /X &amp; Y/);
  assert.match(html, /<DD>hi &lt;there&gt;/);
});

test("export/import round-trip keeps title, tags, date, status", () => {
  const items = [{ url: "https://a.com/x", title: "Title", tags: ["one", "two"], ts: 1710000000000, status: "finished" }];
  const parsed = parseNetscape(buildNetscape(items));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, "Title");
  assert.deepEqual(parsed[0].tags, ["one", "two"]);
  assert.equal(parsed[0].addDate, 1710000000);
  assert.equal(parsed[0].status, "finished");
});
