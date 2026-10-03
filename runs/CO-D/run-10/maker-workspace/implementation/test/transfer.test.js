import test from "node:test";
import assert from "node:assert/strict";
import { applyImport, inspectImport, makeBackup, makeBrowserExport, parseBrowserBookmarks } from "../lib/transfer.js";

const browserFile = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
<DT><H3>Architecture</H3><DL><p>
<DT><A HREF="https://example.com/one" ADD_DATE="1609459200">First page</A>
<DT><H3>Research</H3><DL><p><DT><A HREF="https://example.com/two">Second page</A></DL><p>
</DL><p><DT><A HREF="not a url">Broken</A></DL><p>`;

test("parses nested browser folders as labels and retains saved dates", () => {
  const entries = parseBrowserBookmarks(browserFile);
  assert.deepEqual(entries[0].labels, ["Architecture"]);
  assert.deepEqual(entries[1].labels, ["Architecture", "Research"]);
  assert.equal(entries[0].savedAt, "2021-01-01T00:00:00.000Z");
  assert.equal(entries[1].savedAt, null);
});

test("previews and applies browser imports without overwriting duplicates", () => {
  const existing = [{ id: "old", url: "https://www.example.com/one/", normalizedUrl: "example.com/one", title: "My title", labels: ["Personal"] }];
  const preview = inspectImport(browserFile, "bookmarks.html", existing);
  assert.equal(preview.newCount, 1);
  assert.equal(preview.duplicateCount, 1);
  assert.equal(preview.invalidCount, 1);
  const result = applyImport(browserFile, "bookmarks.html", existing);
  assert.equal(result.bookmarks.length, 2);
  assert.equal(result.bookmarks[0].title, "My title");
  assert.deepEqual(result.bookmarks[1].labels, ["Architecture", "Research"]);
});

test("browser export separates archived bookmarks and complete backup retains app state", () => {
  const bookmarks = [{ id: "1", url: "https://example.com", title: "Example", labels: ["Reading"], savedAt: "2021-01-01T00:00:00.000Z", archived: true, noteHtml: "<ul><li>Keep</li></ul>", readLater: true }];
  const html = makeBrowserExport(bookmarks);
  assert.match(html, /<H3>Archive<\/H3>/);
  assert.match(html, /TAGS="Reading"/);
  const backup = makeBackup(bookmarks);
  assert.equal(backup.bookmarks[0].noteHtml, "<ul><li>Keep</li></ul>");
  assert.equal(backup.bookmarks[0].readLater, true);
});

test("complete backup import rebuilds formatted notes and bookmark states", () => {
  const backup = JSON.stringify({ format: "keepsake-library-backup", version: 1, bookmarks: [{
    id: "restored", url: "https://example.com/restored", title: "Restored title", description: "Restored description",
    labels: ["History"], noteHtml: "<p>Context</p><ul><li>One</li></ul>", readLater: true, archived: true,
    savedAt: "2020-02-03T00:00:00.000Z", updatedAt: "2020-02-04T00:00:00.000Z"
  }] });
  const result = applyImport(backup, "keepsake-library.json", [{ id: "old" }]);
  assert.equal(result.restored, true);
  assert.equal(result.bookmarks.length, 1);
  assert.equal(result.bookmarks[0].noteHtml, "<p>Context</p><ul><li>One</li></ul>");
  assert.equal(result.bookmarks[0].readLater, true);
  assert.equal(result.bookmarks[0].archived, true);
});
