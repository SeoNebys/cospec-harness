import { describe, expect, it } from "vitest";
import { makeTestApp } from "../helpers.js";
import { DuplicateError } from "../../src/services/bookmarks.js";

describe("dedupe / normalization edge cases", () => {
  it("collides on host-case and trailing-slash differences", async () => {
    const { service } = makeTestApp();
    await service.create({ url: "https://Example.com/Docs/" });
    await expect(service.create({ url: "https://example.com/Docs" })).rejects.toBeInstanceOf(
      DuplicateError,
    );
  });

  it("does NOT collide when the path differs", async () => {
    const { service } = makeTestApp();
    await service.create({ url: "https://example.com/a" });
    const b = await service.create({ url: "https://example.com/b" });
    expect(b.id).toBeTruthy();
  });

  it("does NOT collide when the query string differs", async () => {
    const { service } = makeTestApp();
    await service.create({ url: "https://example.com/s?q=1" });
    const b = await service.create({ url: "https://example.com/s?q=2" });
    expect(b.id).toBeTruthy();
  });

  it("treats only the fragment differing as a duplicate", async () => {
    const { service } = makeTestApp();
    await service.create({ url: "https://example.com/p#a" });
    await expect(service.create({ url: "https://example.com/p#b" })).rejects.toBeInstanceOf(
      DuplicateError,
    );
  });
});
