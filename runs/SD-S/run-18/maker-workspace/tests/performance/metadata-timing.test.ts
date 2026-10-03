import { describe, expect, it } from "vitest";
import { parsePageMetadata } from "~/services/metadata/metadata-parser.server";

describe("metadata timing", () => {
  it("parses controlled qualifying responses well within the preview budget", () => {
    const body = Buffer.from(`<html><head><title>Fixture</title><meta name="description" content="Controlled response"></head></html>`);
    const started = performance.now();
    for (let index = 0; index < 100; index++) expect(parsePageMetadata(body).title).toBe("Fixture");
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
