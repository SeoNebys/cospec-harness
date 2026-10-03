"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { createFetcher } = require("../src/fetcher.js");

function htmlResponse(html, ctype) {
  return {
    status: 200,
    headers: { get: (n) => (n.toLowerCase() === "content-type" ? (ctype || "text/html") : null) },
    async text() { return html; },
    async arrayBuffer() { return Buffer.from(html); },
  };
}

test("extracts title and description and builds readable copy (SCN-001/007)", async () => {
  const html = '<html><head><title>Real Title</title><meta name="description" content="A short summary."></head>' +
    '<body><h1>Heading</h1><p>First paragraph.</p><script>ignore()</script></body></html>';
  const f = createFetcher({ fetchImpl: async () => htmlResponse(html) });
  const r = await f.fetchAndPreserve("https://example.com/a");
  assert.equal(r.ok, true);
  assert.equal(r.kind, "html");
  assert.equal(r.title, "Real Title");
  assert.equal(r.desc, "A short summary.");
  const copy = r.buffer.toString("utf8");
  assert.match(copy, /Real Title/);
  assert.match(copy, /First paragraph\./);
  assert.doesNotMatch(copy, /ignore\(\)/); // scripts stripped
});

test("preserves a PDF as original bytes (SCN-007)", async () => {
  const bytes = Buffer.from("%PDF-1.7 fake pdf bytes");
  const res = { status: 200, headers: { get: () => "application/pdf" }, async text() { return ""; }, async arrayBuffer() { return bytes; } };
  const f = createFetcher({ fetchImpl: async () => res });
  const r = await f.fetchAndPreserve("https://x.org/doc.pdf");
  assert.equal(r.ok, true);
  assert.equal(r.kind, "pdf");
  assert.ok(r.buffer.equals(bytes));
});

test("returns ok:false on HTTP error (SCN-011)", async () => {
  const f = createFetcher({ fetchImpl: async () => ({ status: 404, headers: { get: () => "" } }) });
  const r = await f.fetchAndPreserve("https://example.com/missing");
  assert.equal(r.ok, false);
});

test("returns ok:false when the request throws (SCN-011)", async () => {
  const f = createFetcher({ fetchImpl: async () => { throw new Error("network down"); } });
  const r = await f.fetchAndPreserve("https://unreachable.invalid/x");
  assert.equal(r.ok, false);
});
