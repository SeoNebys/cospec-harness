import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("OpenAPI conformance", () => {
  const document = fs.readFileSync("specs/001-bookmark-manager/contracts/openapi.yaml", "utf8");
  it("documents every implemented resource operation without malformed tabs", () => {
    expect(document).not.toMatch(/\t/);
    expect(document).toContain("/api/metadata/preview:");
    expect(document).toContain("/api/bookmarks:");
    expect(document).toContain("/api/bookmarks/{bookmarkId}:");
    expect(document).toContain("/api/tags:");
    for (const operation of ["previewMetadata", "listBookmarks", "createBookmark", "updateBookmark", "deleteBookmark", "listTags"]) {
      expect(document).toContain(`operationId: ${operation}`);
    }
  });
});
