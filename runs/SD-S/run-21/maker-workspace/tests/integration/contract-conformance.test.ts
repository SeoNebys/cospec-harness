import { describe, expect, it } from "vitest";
import fs from "node:fs";
describe("documented contract", () => {
  it("contains every implemented route", () => {
    const spec = fs.readFileSync(
      "specs/001-manage-bookmarks/contracts/openapi.yaml",
      "utf8"
    );
    for (const route of [
      "/metadata/preview:",
      "/bookmarks:",
      "/bookmarks/{id}:",
      "/bookmarks/{id}/archive:",
      "/bookmarks/{id}/restore:",
      "/tags:"
    ])
      expect(spec).toContain(route);
  });
});
