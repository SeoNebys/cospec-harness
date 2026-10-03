import { MetadataCoordinator } from "../../src/server/services/metadata/metadata-coordinator.js";
import type { SafeFetchResult } from "../../src/server/services/metadata/safe-fetch.js";
import { createFastifyTestHarness } from "../helpers/fastify.js";

function htmlResult(address: string, title: string, description = ""): SafeFetchResult {
  return {
    finalUrl: new URL(address),
    statusCode: 200,
    headers: { "content-type": "text/html" },
    contentType: "text/html",
    body: Buffer.from(
      `<title>${title}</title>${
        description ? `<meta name="description" content="${description}">` : ""
      }`,
    ),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("metadata race safety", () => {
  it("keeps a manual edit made while retrieval is in flight and records the late candidate", async () => {
    const harness = await createFastifyTestHarness();
    const response = deferred<SafeFetchResult>();
    try {
      const created = await harness.injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://public.example/race" },
      });
      const id = created.json().id as number;
      const coordinator = new MetadataCoordinator({
        database: harness.testDatabase.database,
        config: harness.config.metadata,
        fetch: {
          html: async () => response.promise,
          icon: async () => {
            throw new Error("No icon in this fixture");
          },
        },
      });
      coordinator.enqueue(id, created.json().address, 1);

      const edited = await harness.injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${id}`,
        payload: { title: "My in-flight edit" },
      });
      expect(edited.statusCode).toBe(200);
      response.resolve(
        htmlResult("https://public.example/race", "Late network title", "Late description"),
      );
      await coordinator.drain();

      const detail = await harness.injectJson({ method: "GET", url: `/api/bookmarks/${id}` });
      expect(detail.json()).toMatchObject({
        title: "My in-flight edit",
        titleProvenance: "user",
        retrievedTitleCandidate: "Late network title",
        description: "Late description",
        descriptionProvenance: "retrieved",
      });
    } finally {
      await harness.close();
    }
  });

  it("lets the newest address revision win when jobs finish out of order", async () => {
    const harness = await createFastifyTestHarness({ config: { metadata: { concurrency: 2 } } });
    const oldResponse = deferred<SafeFetchResult>();
    const newResponse = deferred<SafeFetchResult>();
    try {
      const created = await harness.injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://public.example/old" },
      });
      const id = created.json().id as number;
      const coordinator = new MetadataCoordinator({
        database: harness.testDatabase.database,
        config: harness.config.metadata,
        fetch: {
          html: async (address) =>
            address.endsWith("/old") ? oldResponse.promise : newResponse.promise,
          icon: async () => {
            throw new Error("No icon in this fixture");
          },
        },
      });
      coordinator.enqueue(id, "https://public.example/old", 1);

      const edited = await harness.injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${id}`,
        payload: { address: "https://public.example/new" },
      });
      expect(edited.statusCode).toBe(200);
      expect(
        harness.testDatabase.database
          .prepare("SELECT address_revision AS addressRevision FROM bookmarks WHERE id = ?")
          .get(id),
      ).toEqual({ addressRevision: 2 });
      coordinator.enqueue(id, "https://public.example/new", 2);

      newResponse.resolve(htmlResult("https://public.example/new", "Newest title"));
      oldResponse.resolve(htmlResult("https://public.example/old", "Stale old title"));
      await coordinator.drain();

      const detail = await harness.injectJson({ method: "GET", url: `/api/bookmarks/${id}` });
      expect(detail.json()).toMatchObject({
        address: "https://public.example/new",
        title: "Newest title",
        metadataStatus: "partial",
      });
      expect(detail.body).not.toContain("Stale old title");
    } finally {
      await harness.close();
    }
  });
});
