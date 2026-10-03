import { describe, expect, it } from "vitest";
import { extractMetadata } from "@/lib/metadata/extract";
import { normalizeUrl } from "@/lib/bookmarks/normalize-url";
import { normalizeTag } from "@/lib/bookmarks/normalize-tag";
describe("metadata extraction", () => {
  it("prefers Open Graph and resolves assets", () => {
    const result = extractMetadata(
      `<title>Document</title><meta property="og:title" content="Open title"><meta name="description" content="Summary"><meta property="og:image" content="/cover.jpg"><link rel="icon" href="icon.png">`,
      "https://example.com/a",
      "https://example.com/a"
    );
    expect(result).toMatchObject({
      title: "Open title",
      description: "Summary",
      siteIconUrl: "https://example.com/icon.png",
      previewImageUrl: "https://example.com/cover.jpg"
    });
  });
  it("reports missing optional metadata", () => {
    expect(
      extractMetadata(
        "<html></html>",
        "https://example.com",
        "https://example.com"
      ).warnings
    ).toContain("missing_title");
  });
});
describe("normalization", () => {
  it("normalizes cosmetic URL differences", () =>
    expect(normalizeUrl("HTTPS://Example.COM:443#part")).toBe(
      "https://example.com/"
    ));
  it("normalizes tag case and spacing", () =>
    expect(normalizeTag("  Web   Design ")).toBe("web design"));
});
