import { closeDatabase, openDatabase } from "../../src/server/db/database.js";
import { runMigrations } from "../../src/server/db/migrate.js";
import { MetadataCoordinator } from "../../src/server/services/metadata/metadata-coordinator.js";
import type { SafeFetchResult } from "../../src/server/services/metadata/safe-fetch.js";
import { createFastifyTestHarness } from "../helpers/fastify.js";

describe("durable bookmark capture", () => {
  const htmlResult = (html: string): SafeFetchResult => ({
    finalUrl: new URL("https://example.com/article"),
    statusCode: 200,
    headers: { "content-type": "text/html" },
    contentType: "text/html",
    body: Buffer.from(html),
  });

  it("saves a fallback immediately and survives a database reopen", async () => {
    const harness = await createFastifyTestHarness();
    const response = await harness.injectJson({
      method: "POST",
      url: "/api/bookmarks",
      payload: { address: "https://example.com/long-story", unread: true },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      address: "https://example.com/long-story",
      title: "Long story — example.com",
      titleProvenance: "fallback",
      metadataStatus: "pending",
      unread: true,
    });

    const id = response.json().id as number;
    const databasePath = harness.testDatabase.databasePath;
    await harness.app.close();
    closeDatabase(harness.testDatabase.database);

    const reopened = openDatabase(databasePath);
    runMigrations(reopened);
    expect(reopened.prepare("SELECT id, is_unread FROM bookmarks WHERE id = ?").get(id)).toEqual({
      id,
      is_unread: 1,
    });
    closeDatabase(reopened);
    harness.testDatabase.cleanup();
  });

  it("keeps one row under normalized duplicate attempts, including archived rows", async () => {
    const harness = await createFastifyTestHarness();
    try {
      const first = await harness.injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/item" },
      });
      const id = first.json().id as number;
      harness.testDatabase.database
        .prepare("UPDATE bookmarks SET archived_at = ? WHERE id = ?")
        .run("2026-09-17T00:00:00.000Z", id);

      const second = await harness.injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://EXAMPLE.com:443/item" },
      });
      expect(second.statusCode).toBe(409);
      expect(second.json()).toMatchObject({ existingBookmarkId: id, existingScope: "archived" });
      expect(
        harness.testDatabase.database.prepare("SELECT count(*) AS count FROM bookmarks").get(),
      ).toEqual({ count: 1 });
    } finally {
      await harness.close();
    }
  });

  it("marks supplied text as user-authored so enrichment cannot clobber it", async () => {
    const harness = await createFastifyTestHarness();
    try {
      const response = await harness.injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: {
          address: "https://example.com/custom",
          title: "My title",
          description: "My description",
        },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        title: "My title",
        titleProvenance: "user",
        description: "My description",
        descriptionProvenance: "user",
      });

      const row = harness.testDatabase.database
        .prepare(
          "SELECT title_provenance, description_provenance, address_revision FROM bookmarks WHERE id = ?",
        )
        .get(response.json().id);
      expect(row).toEqual({
        title_provenance: "user",
        description_provenance: "user",
        address_revision: 1,
      });
    } finally {
      await harness.close();
    }
  });

  it("restarts pending jobs and preserves user fields as retrieved candidates", async () => {
    const harness = await createFastifyTestHarness();
    try {
      const created = await harness.injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/article", title: "Kept title" },
      });
      const coordinator = new MetadataCoordinator({
        database: harness.testDatabase.database,
        config: harness.config.metadata,
        now: harness.clock.now,
        fetch: {
          html: async () =>
            htmlResult(
              '<title>Retrieved title</title><meta name="description" content="Retrieved description">',
            ),
          icon: async () => {
            throw new Error("no icon");
          },
        },
      });
      coordinator.start();
      await coordinator.drain();

      expect(
        await harness
          .injectJson({ method: "GET", url: `/api/bookmarks/${created.json().id}` })
          .then((response) => response.json()),
      ).toMatchObject({
        title: "Kept title",
        titleProvenance: "user",
        retrievedTitleCandidate: "Retrieved title",
        description: "Retrieved description",
        descriptionProvenance: "retrieved",
        metadataStatus: "complete",
      });
    } finally {
      await harness.close();
    }
  });

  it("ignores an enrichment result after the address revision changes", async () => {
    const harness = await createFastifyTestHarness();
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      const created = await harness.injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/article" },
      });
      const coordinator = new MetadataCoordinator({
        database: harness.testDatabase.database,
        config: harness.config.metadata,
        fetch: {
          html: async () => {
            await blocked;
            return htmlResult("<title>Stale title</title>");
          },
          icon: async () => {
            throw new Error("no icon");
          },
        },
      });
      coordinator.enqueue(created.json().id, created.json().address, 1);
      harness.testDatabase.database
        .prepare("UPDATE bookmarks SET address_revision = 2 WHERE id = ?")
        .run(created.json().id);
      release?.();
      await coordinator.drain();
      const row = harness.testDatabase.database
        .prepare("SELECT title, metadata_status FROM bookmarks WHERE id = ?")
        .get(created.json().id);
      expect(row).toEqual({ title: "Article — example.com", metadata_status: "pending" });
    } finally {
      await harness.close();
    }
  });
});
