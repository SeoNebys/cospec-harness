import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMetadata, fetchMetadata } from "../../src/metadata.js";

test("parseMetadata extracts title and description", () => {
  const html = `<html><head><title>Hello &amp; World</title>
    <meta name="description" content="A short description."></head><body></body></html>`;
  const m = parseMetadata(html);
  assert.equal(m.title, "Hello & World");
  assert.equal(m.description, "A short description.");
});

test("parseMetadata prefers og: values", () => {
  const html = `<head><title>Fallback</title>
    <meta property="og:title" content="OG Title">
    <meta property="og:description" content="OG desc"></head>`;
  const m = parseMetadata(html);
  assert.equal(m.title, "OG Title");
  assert.equal(m.description, "OG desc");
});

test("fetchMetadata returns ok:false on network error (SCN-006)", async () => {
  const failing = async () => { throw new Error("network down"); };
  const r = await fetchMetadata("https://x.com", failing);
  assert.equal(r.ok, false);
});

test("fetchMetadata returns ok:false on non-ok response", async () => {
  const notOk = async () => ({ ok: false, headers: new Map(), text: async () => "" });
  const r = await fetchMetadata("https://x.com", notOk);
  assert.equal(r.ok, false);
});

test("fetchMetadata parses a successful HTML response", async () => {
  const good = async () => ({
    ok: true,
    headers: { get: () => "text/html" },
    text: async () => "<title>Good Page</title>",
  });
  const r = await fetchMetadata("https://x.com", good);
  assert.equal(r.ok, true);
  assert.equal(r.title, "Good Page");
});
