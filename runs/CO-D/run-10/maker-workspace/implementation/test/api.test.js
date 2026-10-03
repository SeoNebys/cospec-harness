import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createKeepsakeServer } from "../server.js";

async function withServer(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "keepsake-api-"));
  const dataFile = path.join(directory, "library.json");
  const metadataReader = async (url) => ({ available: true, url, siteName: "example.com", title: "Gathered title", description: "Gathered description", favicon: "https://example.com/favicon.ico", previewImage: "https://example.com/preview.jpg" });
  const { server } = await createKeepsakeServer({ dataFile, metadataReader });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (route, options = {}) => {
    const response = await fetch(`${base}${route}`, { ...options, headers: options.body ? { "content-type": "application/json" } : undefined });
    const body = await response.json();
    return { response, body };
  };
  try { await run({ call, dataFile }); } finally { await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
}

test("API saves, detects normalized duplicates, updates personal data, and persists", async () => {
  await withServer(async ({ call, dataFile }) => {
    const metadata = await call("/api/metadata", { method: "POST", body: JSON.stringify({ url: "example.com/story" }) });
    assert.equal(metadata.body.title, "Gathered title");
    const created = await call("/api/bookmarks", { method: "POST", body: JSON.stringify({ url: "https://example.com/story", title: "My title", description: "Mine", labels: ["architecture"], noteHtml: "<p>Note</p><script>bad()</script>" }) });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.bookmark.noteHtml, "<p>Note</p>");
    const duplicate = await call("/api/metadata", { method: "POST", body: JSON.stringify({ url: "https://www.example.com/story/?utm_source=x" }) });
    assert.equal(duplicate.body.duplicate, true);
    assert.equal(duplicate.body.bookmark.title, "My title");
    const updated = await call(`/api/bookmarks/${created.body.bookmark.id}`, { method: "PATCH", body: JSON.stringify({ labels: ["Architecture", "History"], readLater: true }) });
    assert.deepEqual(updated.body.bookmark.labels, ["architecture", "History"]);
    assert.equal(updated.body.bookmark.readLater, true);
    const stored = JSON.parse(await readFile(dataFile, "utf8"));
    assert.equal(stored.bookmarks.length, 1);
    assert.equal(stored.bookmarks[0].title, "My title");
  });
});

test("API performs batch actions and returns both export formats", async () => {
  await withServer(async ({ call }) => {
    const ids = [];
    for (const [index, title] of ["One", "Two"].entries()) {
      const result = await call("/api/bookmarks", { method: "POST", body: JSON.stringify({ url: `https://example.com/${index}`, title }) });
      ids.push(result.body.bookmark.id);
    }
    const labelled = await call("/api/bulk", { method: "POST", body: JSON.stringify({ ids, action: "label", label: "Reading" }) });
    assert.equal(labelled.body.count, 2);
    assert.ok(labelled.body.bookmarks.every((bookmark) => bookmark.labels.includes("Reading")));
    const later = await call("/api/bulk", { method: "POST", body: JSON.stringify({ ids, action: "read-later" }) });
    assert.ok(later.body.bookmarks.every((bookmark) => bookmark.readLater));
    const read = await call("/api/bulk", { method: "POST", body: JSON.stringify({ ids, action: "mark-read" }) });
    assert.ok(read.body.bookmarks.every((bookmark) => !bookmark.readLater));
  });
});

test("saved data reopens from the same library file after a server restart", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "keepsake-restart-"));
  const dataFile = path.join(directory, "library.json");
  const first = await createKeepsakeServer({ dataFile, metadataReader: async () => ({}) });
  await first.store.mutate((data) => {
    data.bookmarks.push({ id: "persisted", url: "https://example.com/kept", normalizedUrl: "example.com/kept", siteName: "example.com", title: "Still here", description: "Saved words", favicon: "", previewImage: "", labels: ["Reading"], noteHtml: "<ul><li>Formatted note</li></ul>", readLater: true, archived: true, savedAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" });
  });
  const second = await createKeepsakeServer({ dataFile, metadataReader: async () => ({}) });
  const reopened = second.store.snapshot().bookmarks[0];
  assert.equal(reopened.title, "Still here");
  assert.deepEqual(reopened.labels, ["Reading"]);
  assert.equal(reopened.noteHtml, "<ul><li>Formatted note</li></ul>");
  assert.equal(reopened.readLater, true);
  assert.equal(reopened.archived, true);
  await rm(directory, { recursive: true, force: true });
});
