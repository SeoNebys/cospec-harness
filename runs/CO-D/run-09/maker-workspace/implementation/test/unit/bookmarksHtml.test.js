const test = require("node:test");
const assert = require("node:assert");
const bh = require("../../lib/bookmarksHtml.js");

const sample = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Work</H3>
  <DL><p>
    <DT><A HREF="https://news.ycombinator.com/" ADD_DATE="1600000000" TAGS="tech,daily">Hacker News</A>
    <DT><A HREF="https://www.rust-lang.org/" ADD_DATE="1610000000">Rust</A>
  </DL><p>
  <DT><A HREF="https://ex.com/a" TAGS="Design,design">Case dupe</A>
</DL><p>`;

test("SCN-021: parse titles, folder+tag labels, dates", () => {
  const items = bh.parse(sample);
  const hn = items.find((i) => i.url.includes("ycombinator"));
  assert.equal(hn.title, "Hacker News");
  assert.deepEqual(hn.tags.sort(), ["Work", "daily", "tech"].sort());
  assert.equal(hn.addedAt, "2020-09-13");
  const rust = items.find((i) => i.url.includes("rust"));
  assert.deepEqual(rust.tags, ["Work"]);
});
test("SCN-021: folder + tag merged without case-duplicates", () => {
  const items = bh.parse(sample);
  const dupe = items.find((i) => i.url === "https://ex.com/a");
  assert.equal(dupe.tags.length, 1); // Design/design collapsed
});
test("SCN-021: generate is round-trippable", () => {
  const out = bh.generate([{ url: "https://x.com/y", title: "Y", tags: ["a", "b"], addedAt: "2024-01-02" }]);
  assert.match(out, /NETSCAPE-Bookmark-file-1/);
  assert.match(out, /HREF="https:\/\/x\.com\/y"/);
  assert.match(out, /TAGS="a,b"/);
  const re = bh.parse(out)[0];
  assert.equal(re.title, "Y");
  assert.deepEqual(re.tags, ["a", "b"]);
  assert.equal(re.addedAt, "2024-01-02");
});
test("SCN-021: non-http links are ignored", () => {
  const items = bh.parse('<A HREF="javascript:void(0)">x</A><A HREF="https://ok.com">ok</A>');
  assert.equal(items.length, 1);
});
