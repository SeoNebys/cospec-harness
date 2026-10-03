import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  cleanMetadataText,
  extractPageMetadata,
} from "../../src/server/services/metadata/extract-metadata.js";
import {
  IconProcessingError,
  processIcon,
  processIconOrNull,
} from "../../src/server/services/metadata/process-icon.js";

const fixtureDirectory = fileURLToPath(new URL("../fixtures/metadata/", import.meta.url));

async function fixture(name: string): Promise<string> {
  return readFile(`${fixtureDirectory}/${name}`, "utf8");
}

describe("page metadata extraction", () => {
  it("prefers the HTML title and standard description over Open Graph values", async () => {
    const result = extractPageMetadata(
      await fixture("complete.html"),
      new URL("https://metadata.test/articles/complete"),
    );

    expect(result).toMatchObject({
      title: "Fixture Article: A Complete Page",
      titleSource: "html",
      description: "A deterministic description from the standard metadata field.",
      descriptionSource: "standard",
    });
    expect(result.iconCandidates[0]).toMatchObject({
      url: "https://metadata.test/assets/icon.png",
      declaredType: "image/png",
    });
    expect(result.iconCandidates.at(-1)?.url).toBe("https://metadata.test/favicon.ico");
  });

  it("uses Open Graph text only when native metadata is absent", async () => {
    const result = extractPageMetadata(
      await fixture("open-graph.html"),
      "https://metadata.test/article",
    );

    expect(result).toMatchObject({
      title: "Open Graph Fixture Title",
      titleSource: "open_graph",
      description: "Description supplied only by Open Graph.",
      descriptionSource: "open_graph",
    });
  });

  it("uses the first valid base URL and resolves relative declared icons", async () => {
    const result = extractPageMetadata(
      await fixture("base-url.html"),
      "https://metadata.test/articles/one",
    );

    expect(result.baseUrl.href).toBe("https://cdn.metadata.test/site/");
    expect(result.iconCandidates[0]?.url).toBe("https://cdn.metadata.test/site/icons/site.png");
  });

  it("tolerates malformed markup and recovers useful head metadata", async () => {
    const result = extractPageMetadata(
      await fixture("malformed.html.fixture"),
      "https://metadata.test/deep/page",
    );

    expect(result.title).toBe("Malformed but Recoverable");
    expect(result.description).toBe("A parser should tolerate this missing title close tag.");
    expect(result.iconCandidates[0]?.url).toBe("https://metadata.test/broken-relative/icon.png");
  });

  it("collapses whitespace, removes control characters, and applies scalar limits", async () => {
    const result = extractPageMetadata(
      await fixture("whitespace.html"),
      "https://metadata.test/space",
    );

    expect(result.title).toBe("A title with deliberate whitespace");
    expect(result.description).toBe("A description that needs cleanup.");
    expect(cleanMetadataText(`  hello\u0000  world ${"🌱".repeat(5)}`, 14)).toBe(
      "hello world 🌱🌱",
    );
  });

  it("returns an address-derived title and an empty description when values are missing", async () => {
    const result = extractPageMetadata(
      await fixture("missing.html"),
      "https://www.example.com/guides/reading-list?from=home",
    );

    expect(result).toMatchObject({
      title: "example.com / guides / reading-list",
      titleSource: "fallback",
      description: "",
      descriptionSource: "missing",
    });
    expect(result.iconCandidates).toEqual([
      expect.objectContaining({ url: "https://www.example.com/favicon.ico", source: "fallback" }),
    ]);
  });

  it("ignores active or non-HTTP declared icon candidates", async () => {
    const result = extractPageMetadata(
      `${await fixture("unsafe-icon.html")}<link rel="icon" href="data:image/png;base64,AAAA">`,
      "https://metadata.test/page",
    );

    expect(result.iconCandidates).toEqual([
      expect.objectContaining({ url: "https://metadata.test/favicon.ico", source: "fallback" }),
    ]);
  });
});

describe("icon processing", () => {
  it("validates a raster signature and emits deterministic, app-safe PNG bytes", async () => {
    const source = Buffer.from((await fixture("icon-1x1.png.base64")).trim(), "base64");
    const first = await processIcon(source, { contentType: "image/png" });
    const second = await processIcon(source, { contentType: "application/octet-stream" });

    expect(first.mimeType).toBe("image/png");
    expect(first.width).toBe(1);
    expect(first.height).toBe(1);
    expect(first.byteLength).toBe(first.pngBytes.byteLength);
    expect(first.pngBytes.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(first.contentHash).toMatch(/^[a-f\d]{64}$/);
    expect(second.contentHash).toBe(first.contentHash);
  });

  it.each([
    ["SVG", "active-icon.svg.fixture", "image/svg+xml"],
    ["HTML", "not-an-icon.html", "text/html"],
  ])("rejects active %s icon content", async (_label, name, contentType) => {
    await expect(
      processIcon(Buffer.from(await fixture(name)), { contentType }),
    ).rejects.toBeInstanceOf(IconProcessingError);
  });

  it("rejects spoofed and over-limit input and offers a safe null fallback", async () => {
    const spoofed = Buffer.from("not really a png");

    await expect(processIcon(spoofed, { contentType: "image/png" })).rejects.toMatchObject({
      code: "unsupported_format",
    });
    await expect(
      processIcon(Buffer.alloc(20), { contentType: "image/png", maxInputBytes: 10 }),
    ).rejects.toMatchObject({ code: "input_too_large" });
    await expect(processIconOrNull(spoofed, { contentType: "image/png" })).resolves.toBeNull();
  });
});
