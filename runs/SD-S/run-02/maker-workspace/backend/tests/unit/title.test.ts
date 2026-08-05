import { describe, expect, it } from "vitest";
import { extractTitle } from "../../src/services/title.js";

describe("extractTitle", () => {
  it("extracts <title> and collapses whitespace", () => {
    const html = "<html><head><title>  Hello\n  World </title></head></html>";
    expect(extractTitle(html)).toBe("Hello World");
  });

  it("falls back to og:title when <title> is absent", () => {
    const html =
      '<html><head><meta property="og:title" content="OG Title"></head></html>';
    expect(extractTitle(html)).toBe("OG Title");
  });

  it("prefers <title> over og:title", () => {
    const html =
      '<html><head><title>Real</title><meta property="og:title" content="OG"></head></html>';
    expect(extractTitle(html)).toBe("Real");
  });

  it("returns null when nothing is available", () => {
    expect(extractTitle("<html><head></head><body>x</body></html>")).toBeNull();
  });
});
