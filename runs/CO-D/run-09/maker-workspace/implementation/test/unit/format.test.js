const test = require("node:test");
const assert = require("node:assert");
const F = require("../../public/format.js");

test("SCN-019: bold, italic, inline code, links", () => {
  const h = F.render("**b** *i* `c` [x](https://e.com)");
  assert.match(h, /<strong>b<\/strong>/);
  assert.match(h, /<em>i<\/em>/);
  assert.match(h, /<code>c<\/code>/);
  assert.match(h, /<a href="https:\/\/e\.com"[^>]*>x<\/a>/);
});
test("SCN-019: headings and both list types", () => {
  const h = F.render("# Title\n## Sub\n- a\n- b\n1. one\n2. two");
  assert.match(h, /<h3>Title<\/h3>/);
  assert.match(h, /<h4>Sub<\/h4>/);
  assert.match(h, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(h, /<ol><li>one<\/li><li>two<\/li><\/ol>/);
});
test("SCN-019: input is escaped (safe)", () => {
  const h = F.render("<script>alert(1)</script>");
  assert.ok(!h.includes("<script>"));
  assert.match(h, /&lt;script&gt;/);
});
test("SCN-019: plain note reads naturally", () => {
  assert.equal(F.render("just a note"), "<div>just a note</div>");
});
