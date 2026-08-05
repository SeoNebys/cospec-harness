import { describe, it, expect } from "vitest";
import { extractTitle, fetchTitle } from "../../src/services/titleFetcher.js";

describe("extractTitle", () => {
  it("extracts and trims the <title>", () => {
    expect(extractTitle("<html><head><title>  Hello  World </title></head></html>")).toBe("Hello World");
  });

  it("decodes basic entities", () => {
    expect(extractTitle("<title>Tom &amp; Jerry</title>")).toBe("Tom & Jerry");
  });

  it("returns null when there is no title", () => {
    expect(extractTitle("<html><head></head></html>")).toBeNull();
    expect(extractTitle("")).toBeNull();
  });
});

describe("fetchTitle (best-effort)", () => {
  it("returns the parsed title on a successful fetch", async () => {
    const fakeFetch = async () => ({
      ok: true,
      text: async () => "<title>Example Domain</title>",
    });
    expect(await fetchTitle("https://example.com", { fetchImpl: fakeFetch })).toBe("Example Domain");
  });

  it("returns null on non-OK responses", async () => {
    const fakeFetch = async () => ({ ok: false, text: async () => "" });
    expect(await fetchTitle("https://example.com", { fetchImpl: fakeFetch })).toBeNull();
  });

  it("returns null when the fetch throws (network error / timeout)", async () => {
    const fakeFetch = async () => {
      throw new Error("network down");
    };
    expect(await fetchTitle("https://example.com", { fetchImpl: fakeFetch })).toBeNull();
  });
});
