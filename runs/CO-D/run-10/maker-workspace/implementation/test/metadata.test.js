import test from "node:test";
import assert from "node:assert/strict";
import { parseMetadata } from "../lib/metadata.js";

test("extracts recognizable page metadata and resolves relative assets", () => {
  const html = `<!doctype html><html><head>
    <title>Fallback title</title>
    <meta property="og:title" content="A gathered title">
    <meta name="description" content="A useful description">
    <meta property="og:image" content="/preview.jpg">
    <link rel="icon" href="/favicon.png">
  </head></html>`;
  assert.deepEqual(parseMetadata(html, "https://example.com/story"), {
    title: "A gathered title", description: "A useful description",
    previewImage: "https://example.com/preview.jpg", favicon: "https://example.com/favicon.png", siteName: "example.com"
  });
});
