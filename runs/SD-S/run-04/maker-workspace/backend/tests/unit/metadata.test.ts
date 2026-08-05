import { describe, it, expect } from "vitest";
import { parseMetadata } from "../../src/services/metadataFetcher.js";

const base = "https://example.com/article";

describe("parseMetadata", () => {
  it("prefers Open Graph tags", () => {
    const html = `
      <html><head>
        <title>Plain Title</title>
        <meta property="og:title" content="OG Title" />
        <meta property="og:description" content="OG description" />
        <meta property="og:image" content="https://cdn.example.com/img.png" />
      </head></html>`;
    expect(parseMetadata(html, base)).toEqual({
      title: "OG Title",
      description: "OG description",
      imageUrl: "https://cdn.example.com/img.png",
    });
  });

  it("falls back to Twitter card, then HTML title/description", () => {
    const html = `
      <html><head>
        <title>Plain Title</title>
        <meta name="twitter:title" content="Tw Title" />
        <meta name="description" content="Meta description" />
      </head></html>`;
    const md = parseMetadata(html, base);
    expect(md.title).toBe("Tw Title");
    expect(md.description).toBe("Meta description");
    expect(md.imageUrl).toBeNull();
  });

  it("uses the <title> when no OG/Twitter title exists", () => {
    const html = `<html><head><title>Just a Title</title></head></html>`;
    expect(parseMetadata(html, base).title).toBe("Just a Title");
  });

  it("resolves relative image URLs against the page URL", () => {
    const html = `<html><head><meta property="og:image" content="/thumb.jpg" /></head></html>`;
    expect(parseMetadata(html, base).imageUrl).toBe("https://example.com/thumb.jpg");
  });

  it("returns nulls for a page with no usable metadata", () => {
    expect(parseMetadata("<html><body>hi</body></html>", base)).toEqual({
      title: null,
      description: null,
      imageUrl: null,
    });
  });
});
