import test from "node:test";
import assert from "node:assert/strict";
import { parsePageInfo, fetchPageInfo } from "../../src/pageinfo.js";

test("parsePageInfo reads <title> and meta description (SCN-001)", () => {
  const html = `<html><head><title>How to Read More &amp; Enjoy It</title>
    <meta name="description" content="Habits for a steady reading routine."></head><body>x</body></html>`;
  const info = parsePageInfo(html);
  assert.equal(info.title, "How to Read More & Enjoy It");
  assert.equal(info.description, "Habits for a steady reading routine.");
});

test("parsePageInfo prefers og:title / og:description", () => {
  const html = `<head><meta property="og:title" content="OG Title">
    <title>Fallback</title><meta property="og:description" content="OG desc"></head>`;
  const info = parsePageInfo(html);
  assert.equal(info.title, "OG Title");
  assert.equal(info.description, "OG desc");
});

test("parsePageInfo returns empty when no title (SCN-006 trigger)", () => {
  const info = parsePageInfo("<html><body>no head here</body></html>");
  assert.equal(info.title, "");
});

test("fetchPageInfo never throws; failure yields ok:false (SCN-006)", async () => {
  const boom = async () => { throw new Error("network down"); };
  const r = await fetchPageInfo("https://example.com", { fetchImpl: boom });
  assert.deepEqual(r, { title: "", description: "", ok: false });
});

test("fetchPageInfo returns parsed info on success (SCN-001)", async () => {
  const fakeFetch = async () => ({
    ok: true,
    headers: { get: () => "text/html; charset=utf-8" },
    text: async () => "<head><title>Real Title</title></head>",
  });
  const r = await fetchPageInfo("https://example.com", { fetchImpl: fakeFetch });
  assert.equal(r.ok, true);
  assert.equal(r.title, "Real Title");
});

test("fetchPageInfo treats non-html as failure", async () => {
  const fakeFetch = async () => ({
    ok: true,
    headers: { get: () => "application/pdf" },
    text: async () => "%PDF-1.4",
  });
  const r = await fetchPageInfo("https://example.com/x.pdf", { fetchImpl: fakeFetch });
  assert.equal(r.ok, false);
});
