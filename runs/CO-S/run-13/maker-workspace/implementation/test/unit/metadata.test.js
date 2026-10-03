import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMetadata, fetchMetadata, InvalidUrlError } from "../../src/metadata.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, "..", "..", "fixtures", name), "utf8");
const BASE = "https://calm.example.com/post";

test("parseMetadata prefers og:title and resolves relative image/icon (SCN-001)", () => {
  const m = parseMetadata(fixture("article.html"), BASE);
  assert.equal(m.title, "Designing a Calm Bookmark Manager");
  assert.equal(m.description, "How a single private library keeps nothing from getting lost.");
  assert.equal(m.site, "Calm Reading");
  assert.equal(m.image, "https://calm.example.com/__fixtures/preview.svg");
  assert.equal(m.icon, "https://calm.example.com/__fixtures/icon.svg");
});

test("parseMetadata falls back to <title> and has no preview when og:image absent (SCN-001)", () => {
  const m = parseMetadata(fixture("no-preview.html"), BASE);
  assert.equal(m.title, "Plain Page Without A Preview Image");
  assert.equal(m.image, null);
  // no declared icon -> defaults to the site's /favicon.ico
  assert.equal(m.icon, "https://calm.example.com/favicon.ico");
});

test("fetchMetadata returns ok:true for HTML (SCN-001)", async () => {
  const fakeFetch = async () => ({
    ok: true,
    headers: new Map([["content-type", "text/html; charset=utf-8"]]),
    text: async () => fixture("article.html"),
  });
  const r = await fetchMetadata("calm.example.com/post", { fetchImpl: fakeFetch });
  assert.equal(r.ok, true);
  assert.equal(r.host, "calm.example.com");
  assert.equal(r.title, "Designing a Calm Bookmark Manager");
});

test("fetchMetadata returns ok:false for non-HTML (SCN-010)", async () => {
  const fakeFetch = async () => ({
    ok: true,
    headers: new Map([["content-type", "application/json"]]),
    text: async () => "{}",
  });
  const r = await fetchMetadata("https://example.com/data.json", { fetchImpl: fakeFetch });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "not_html");
});

test("fetchMetadata returns ok:false when unreachable (SCN-010)", async () => {
  const fakeFetch = async () => { throw new Error("ECONNREFUSED"); };
  const r = await fetchMetadata("https://example.com", { fetchImpl: fakeFetch });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "unreachable");
  assert.equal(r.host, "example.com");
});

test("fetchMetadata rejects an invalid address before any request (SCN-010)", async () => {
  await assert.rejects(() => fetchMetadata("not a url"), InvalidUrlError);
});
