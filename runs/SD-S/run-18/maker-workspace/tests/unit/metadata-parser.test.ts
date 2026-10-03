import { describe, expect, it } from "vitest";
import { parsePageMetadata } from "~/services/metadata/metadata-parser.server";

describe("parsePageMetadata", () => {
  it("prefers the document title and standard description", () => {
    expect(parsePageMetadata(Buffer.from(`<!doctype html><head><title>  A &amp; B  </title><meta property="og:title" content="Other"><meta name="description" content=" A useful page. "><meta property="og:description" content="Other"></head>`))).toEqual({ title: "A & B", description: "A useful page." });
  });

  it("falls back through social metadata case-insensitively", () => {
    expect(parsePageMetadata(Buffer.from(`<META PROPERTY="OG:TITLE" CONTENT="Open graph"><meta name="twitter:description" content="Short summary">`))).toEqual({ title: "Open graph", description: "Short summary" });
  });

  it("strips controls and caps returned values", () => {
    const result = parsePageMetadata(Buffer.from(`<title>Hi\u0000\u202e ${"x".repeat(400)}</title><meta name="description" content="${"d".repeat(1200)}">`));
    expect(result.title).not.toMatch(/[\u0000\u202e]/);
    expect(result.title?.length).toBe(300);
    expect(result.description?.length).toBe(1000);
  });
});
