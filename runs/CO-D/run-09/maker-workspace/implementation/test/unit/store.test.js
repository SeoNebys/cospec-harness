const test = require("node:test");
const assert = require("node:assert");
const store = require("../../lib/store.js");

test("normUrl ignores protocol, leading www., trailing slash, case (SCN-003)", () => {
  const a = store.normUrl("https://www.Example.com/Path/");
  assert.equal(a, "example.com/path");
  assert.equal(store.normUrl("http://example.com/path"), a);
  assert.equal(store.normUrl("example.com/path"), a);
});
test("looksLikeLink accepts urls, rejects free text (SCN-012)", () => {
  assert.ok(store.looksLikeLink("example.com/article"));
  assert.ok(store.looksLikeLink("https://x.io"));
  assert.ok(!store.looksLikeLink("grocery list ideas"));
  assert.ok(!store.looksLikeLink("just-text"));
});
test("domainOf strips www", () => {
  assert.equal(store.domainOf("https://www.nytimes.com/x"), "nytimes.com");
  assert.equal(store.domainOf("developer.mozilla.org/y"), "developer.mozilla.org");
});
