import assert from "node:assert/strict";
import test from "node:test";
import { fallbackTitle, parseDocumentMetadata } from "../../lib/metadata/html.js";

test("extracts the first document title, decodes entities, normalizes whitespace, and caps at 300 characters", () => {
  const long = `  First &amp;   ${"x".repeat(400)}  `;
  const result = parseDocumentMetadata(`<html><head><title>${long}</title><title>Second</title></head></html>`, "https://example.com/page");
  assert.equal(result.title?.startsWith("First & "), true);
  assert.equal(result.title?.length, 300);
  assert.equal(result.title?.includes("  "), false);
});

test("uses only head title and never executes page scripts", () => {
  (globalThis as typeof globalThis & { metadataParserExecuted?: boolean }).metadataParserExecuted = false;
  const result = parseDocumentMetadata(`<body><title>Body title</title><script>globalThis.metadataParserExecuted=true</script></body>`, "https://example.com");
  assert.equal(result.title, null);
  assert.equal((globalThis as typeof globalThis & { metadataParserExecuted?: boolean }).metadataParserExecuted, false);
});

test("discovers rel-token icons, resolves URLs, rejects SVG, and appends favicon fallback", () => {
  const result = parseDocumentMetadata(`<head>
    <link rel="apple-touch icon" href="/large.png" type="image/png" sizes="180x180">
    <link rel="icon" href="small.ico" sizes="16x16">
    <link rel="icon" href="bad.svg" type="image/svg+xml">
  </head>`, "https://example.com/docs/page");
  assert.equal(result.iconCandidates[0]?.url, "https://example.com/large.png");
  assert.equal(result.iconCandidates.some((item) => item.url.endsWith("bad.svg")), false);
  assert.equal(result.iconCandidates.at(-1)?.url, "https://example.com/favicon.ico");
});

test("creates an editable URL-derived fallback", () => {
  assert.equal(fallbackTitle("https://example.com/useful/page?ignored=true"), "example.com/useful/page");
});

