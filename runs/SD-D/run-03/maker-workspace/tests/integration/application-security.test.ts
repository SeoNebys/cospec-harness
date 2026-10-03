import { buildApp } from "../../src/server/app.js";
import { createFastifyTestHarness, TEST_APP_HOST } from "../helpers/fastify.js";

describe("application security boundary", () => {
  it("sets browser isolation, MIME, framing, and referrer headers", async () => {
    const harness = await createFastifyTestHarness();
    try {
      const response = await harness.inject({ method: "GET", url: "/api/health" });
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
      expect(response.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["referrer-policy"]).toBe("no-referrer");
      expect(response.headers["cross-origin-resource-policy"]).toBe("same-origin");
    } finally {
      await harness.close();
    }
  });

  it("accepts mutations only as same-origin JSON", async () => {
    const harness = await createFastifyTestHarness();
    try {
      const nonJson = await harness.inject({
        method: "POST",
        url: "/api/bookmarks",
        headers: { host: TEST_APP_HOST, "content-type": "text/plain" },
        payload: "address=https://example.com",
      });
      expect(nonJson.statusCode).toBe(415);
      expect(nonJson.json()).toEqual({
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Mutation requests must use application/json.",
      });

      const crossOrigin = await harness.inject({
        method: "POST",
        url: "/api/bookmarks",
        headers: {
          host: TEST_APP_HOST,
          origin: "https://attacker.invalid",
          "content-type": "application/json",
        },
        payload: { address: "https://example.com" },
      });
      expect(crossOrigin.statusCode).toBe(403);
      expect(crossOrigin.json()).toEqual({
        code: "ORIGIN_NOT_ALLOWED",
        message: "This request origin is not allowed.",
      });
      expect(
        harness.testDatabase.database.prepare("SELECT count(*) AS count FROM bookmarks").get(),
      ).toEqual({ count: 0 });
    } finally {
      await harness.close();
    }
  });

  it("returns friendly validation and internal errors without stack or database details", async () => {
    const harness = await createFastifyTestHarness({
      build: async (dependencies) => {
        const app = await buildApp(dependencies);
        app.get("/api/test-internal-error", async () => {
          throw new Error("SQLITE_SECRET /private/path.db 127.0.0.1");
        });
        return app;
      },
    });
    try {
      const invalid = await harness.injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: 42, unexpected: "secret" },
      });
      expect(invalid.statusCode).toBe(422);
      expect(invalid.json()).toEqual({
        code: "VALIDATION_ERROR",
        message: "One or more request fields are invalid.",
      });
      expect(invalid.body).not.toContain("stack");
      expect(invalid.body).not.toContain("unexpected");

      const internal = await harness.inject({ method: "GET", url: "/api/test-internal-error" });
      expect(internal.statusCode).toBe(500);
      expect(internal.json()).toEqual({
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
      });
      expect(internal.body).not.toMatch(/SQLITE_SECRET|private\/path|127\.0\.0\.1|stack/i);

      const missing = await harness.inject({ method: "GET", url: "/api/not-here" });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ code: "NOT_FOUND", message: "Resource not found." });
    } finally {
      await harness.close();
    }
  });
});
