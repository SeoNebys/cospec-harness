import { describe, it, expect } from "vitest";
import { isValidHttpUrl, normalizeUrlKey, createBookmarkModel } from "../../src/models/bookmark.js";
import { createDb } from "../../src/db.js";

describe("isValidHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isValidHttpUrl("http://example.com")).toBe(true);
    expect(isValidHttpUrl("https://example.com/path?q=1")).toBe(true);
  });

  it("rejects non-http(s) and malformed input", () => {
    expect(isValidHttpUrl("not a url")).toBe(false);
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("")).toBe(false);
    expect(isValidHttpUrl(null)).toBe(false);
  });
});

describe("normalizeUrlKey", () => {
  it("lowercases scheme and host and trims a trailing slash", () => {
    expect(normalizeUrlKey("HTTPS://Example.COM/")).toBe("https://example.com");
    expect(normalizeUrlKey("https://example.com/path/")).toBe("https://example.com/path");
  });

  it("treats trailing-slash and host-case variants as the same key", () => {
    expect(normalizeUrlKey("https://Example.com")).toBe(normalizeUrlKey("https://example.com/"));
  });

  it("keeps query strings so different pages stay distinct", () => {
    expect(normalizeUrlKey("https://example.com/s?q=a")).not.toBe(
      normalizeUrlKey("https://example.com/s?q=b")
    );
  });
});

describe("bookmark model", () => {
  const model = createBookmarkModel(createDb(":memory:"));

  it("creates and lists newest-first, falling back title to the url", () => {
    const a = model.create({ url: "https://a.example.com", title: "", createdAt: "2026-01-01T00:00:00.000Z" });
    const b = model.create({ url: "https://b.example.com", title: "B", createdAt: "2026-02-01T00:00:00.000Z" });

    expect(a.title).toBe("https://a.example.com"); // fallback to url
    expect(b.title).toBe("B");

    const list = model.list();
    expect(list.map((x) => x.id)).toEqual([b.id, a.id]); // newest first
  });

  it("finds duplicates by normalized url", () => {
    const m = createBookmarkModel(createDb(":memory:"));
    m.create({ url: "https://dup.example.com/page" });
    expect(m.findByUrl("https://DUP.example.com/page/")).not.toBeNull();
    expect(m.findByUrl("https://other.example.com")).toBeNull();
  });
});
