"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { parseMetadata, fetchMetadata } = require("../lib/metadata.js");

test("SCN-001 parseMetadata extracts title/description/image/favicon", () => {
  const html = `<html><head>
    <title>Fallback Title</title>
    <meta property="og:title" content="OG Title">
    <meta name="description" content="A description here">
    <meta property="og:image" content="/img/hero.png">
    <meta property="og:site_name" content="Example News">
    <link rel="icon" href="/favicon.png">
  </head><body></body></html>`;
  const m = parseMetadata(html, "https://news.example.com/story");
  assert.equal(m.ok, true);
  assert.equal(m.title, "OG Title");
  assert.equal(m.description, "A description here");
  assert.equal(m.site, "Example News");
  assert.equal(m.image, "https://news.example.com/img/hero.png");
  assert.equal(m.favicon, "https://news.example.com/favicon.png");
});

test("SCN-001 parseMetadata falls back to <title> and domain", () => {
  const m = parseMetadata("<title>  Just Title </title>", "https://plain.example.org/x");
  assert.equal(m.title, "Just Title");
  assert.equal(m.site, "plain.example.org");
});

test("SCN-002 fetchMetadata returns ok:false when unreachable", async () => {
  const failing = async () => { throw new Error("ECONNREFUSED"); };
  const r = await fetchMetadata("https://unreachable.test/", { fetchImpl: failing });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "unreachable");
});

test("SCN-002 fetchMetadata rejects invalid url without fetching", async () => {
  let called = false;
  await fetchMetadata("not a url", { fetchImpl: async () => { called = true; } });
  assert.equal(called, false);
});

test("fetchMetadata parses a mocked reachable page", async () => {
  const mock = async () => ({ ok: true, url: "https://m.example.com/", headers: { get: () => "text/html" }, text: async () => '<title>Mock</title><meta name="description" content="d">' });
  const r = await fetchMetadata("m.example.com", { fetchImpl: mock });
  assert.equal(r.ok, true);
  assert.equal(r.title, "Mock");
  assert.equal(r.description, "d");
});

test("fetchMetadata treats PDF content-type as a PDF", async () => {
  const mock = async () => ({ ok: true, url: "https://x.example.com/report.pdf", headers: { get: () => "application/pdf" }, text: async () => "" });
  const r = await fetchMetadata("https://x.example.com/report.pdf", { fetchImpl: mock });
  assert.equal(r.ok, true);
  assert.equal(r.kind, "pdf");
});
