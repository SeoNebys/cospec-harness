import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMetadata, resolveUrl, extractFavicon } from "../../src/metadata.mjs";

const base = "https://example.com/articles/thing";

test("prefers Open Graph tags", () => {
  const html = `
    <html><head>
      <title>Fallback Title</title>
      <meta property="og:title" content="OG Title" />
      <meta property="og:description" content="OG description here" />
      <meta property="og:image" content="/img/preview.png" />
    </head></html>`;
  const m = parseMetadata(html, base);
  assert.equal(m.title, "OG Title");
  assert.equal(m.description, "OG description here");
  assert.equal(m.image, "https://example.com/img/preview.png");
  assert.equal(m.host, "example.com");
});

test("falls back to <title> and meta description", () => {
  const html = `<html><head><title>Just Title</title>
    <meta name="description" content="Plain description"></head></html>`;
  const m = parseMetadata(html, base);
  assert.equal(m.title, "Just Title");
  assert.equal(m.description, "Plain description");
});

test("tolerates content-before-property attribute order", () => {
  const html = `<meta content="Reversed" property="og:title">`;
  assert.equal(parseMetadata(html, base).title, "Reversed");
});

test("decodes HTML entities and collapses whitespace", () => {
  const html = `<title>Tom &amp; Jerry\n   Show</title>`;
  assert.equal(parseMetadata(html, base).title, "Tom & Jerry Show");
});

test("favicon from link rel, else /favicon.ico", () => {
  const withIcon = `<link rel="icon" href="/assets/fav.png">`;
  assert.equal(extractFavicon(withIcon, base), "https://example.com/assets/fav.png");
  assert.equal(extractFavicon("<html></html>", base), "https://example.com/favicon.ico");
});

test("resolveUrl resolves relative against base", () => {
  assert.equal(resolveUrl("/a/b.png", base), "https://example.com/a/b.png");
  assert.equal(resolveUrl("https://cdn.x/y.png", base), "https://cdn.x/y.png");
});

test("missing details yield empty strings, not errors", () => {
  const m = parseMetadata("<html><head></head></html>", base);
  assert.equal(m.title, "");
  assert.equal(m.description, "");
  assert.equal(m.image, "");
});
