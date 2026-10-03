import { test } from "node:test";
import assert from "node:assert/strict";
import { readPageDetails } from "../../src/metadata.js";

function fakeResponse({ ok = true, contentType = "text/html", body = "" }) {
  return {
    ok,
    headers: { get: (h) => (h.toLowerCase() === "content-type" ? contentType : null) },
    text: async () => body,
  };
}

test("reads <title> and meta description from HTML (SCN-001)", async () => {
  const html = `<html><head><title>Hello &amp; World</title>
    <meta name="description" content="A nice page"></head><body></body></html>`;
  const d = await readPageDetails("https://example.com/page", {
    fetchImpl: async () => fakeResponse({ body: html }),
  });
  assert.equal(d.title, "Hello & World");
  assert.equal(d.description, "A nice page");
  assert.equal(d.site, "example.com");
  assert.equal(d.unreadable, false);
});

test("prefers Open Graph tags when present", async () => {
  const html = `<html><head>
    <meta property="og:title" content="OG Title">
    <meta property="og:description" content="OG Desc">
    <title>Fallback</title></head></html>`;
  const d = await readPageDetails("https://example.com/", {
    fetchImpl: async () => fakeResponse({ body: html }),
  });
  assert.equal(d.title, "OG Title");
  assert.equal(d.description, "OG Desc");
});

test("unreadable when the response is not ok — link kept with fallback (SCN-007)", async () => {
  const d = await readPageDetails("https://example.com/broken-page", {
    fetchImpl: async () => fakeResponse({ ok: false }),
  });
  assert.equal(d.unreadable, true);
  assert.equal(d.title, "Broken Page");
  assert.equal(d.site, "example.com");
});

test("unreadable when content is not HTML (SCN-007)", async () => {
  const d = await readPageDetails("https://example.com/file.pdf", {
    fetchImpl: async () => fakeResponse({ contentType: "application/pdf", body: "%PDF" }),
  });
  assert.equal(d.unreadable, true);
});

test("unreadable on network error — never throws (SCN-007)", async () => {
  const d = await readPageDetails("https://example.com/x", {
    fetchImpl: async () => { throw new Error("network down"); },
  });
  assert.equal(d.unreadable, true);
  assert.equal(d.site, "example.com");
});
