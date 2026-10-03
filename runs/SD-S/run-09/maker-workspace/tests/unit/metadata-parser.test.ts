import { describe, expect, it } from "vitest";
import { parseMetadata } from "../../src/server/metadata/parse-metadata.js";

describe("metadata parser",()=>{
  it("uses title before social metadata and resolves icons",()=>{const result=parseMetadata(Buffer.from(`<html><head><title>  Page &amp; Name </title><meta property="og:title" content="Social"><link rel="icon" href="/icon.png"></head></html>`),"https://example.com/article");expect(result.title).toBe("Page & Name");expect(result.iconUrl?.toString()).toBe("https://example.com/icon.png");});
  it("falls through to Open Graph and caps titles",()=>{const result=parseMetadata(Buffer.from(`<meta property="og:title" content="${"x".repeat(400)}">`),"https://example.com");expect([...result.title!]).toHaveLength(300);});
});
