import { readFile } from "node:fs/promises";
import { Value } from "typebox/value";
import { buildApp } from "../../src/server/app.js";
import {
  BookmarkIconResponseSchema,
  BookmarkPageSchema,
  BookmarkSchema,
  BulkResultSchema,
  HealthResponseSchema,
  MetadataPreviewSchema,
  MetadataRefreshResponseSchema,
  SavedViewListSchema,
  SavedViewSchema,
  SelectionSchema,
  TagSummaryListSchema,
} from "../../src/shared/contracts/api.js";
import { createFastifyTestHarness } from "../helpers/fastify.js";

const expectedOperations = [
  "getHealth",
  "previewMetadata",
  "listBookmarks",
  "createBookmark",
  "getBookmark",
  "updateBookmark",
  "deleteBookmark",
  "refreshBookmarkMetadata",
  "getBookmarkIcon",
  "listTags",
  "createSelection",
  "clearSelection",
  "applyBulkAction",
  "listSavedViews",
  "createSavedView",
  "updateSavedView",
  "deleteSavedView",
] as const;

function expectSchema(schema: Parameters<typeof Value.Check>[0], value: unknown): void {
  expect(Value.Check(schema, value), [...Value.Errors(schema, value)]).toBe(true);
}

describe("OpenAPI and runtime response conformance", () => {
  it("keeps a structurally valid, complete, uniquely named OpenAPI operation inventory", async () => {
    const source = await readFile("specs/001-bookmark-manager/contracts/openapi.yaml", "utf8");
    expect(source.startsWith("openapi: 3.1.0\n")).toBe(true);
    expect(source).not.toContain("\t");
    expect(source).toMatch(/servers:\n\s+- url: \/api/);
    const operationIds = [
      ...source.matchAll(/^\s+operationId:\s+([A-Za-z][A-Za-z0-9]*)\s*$/gm),
    ].map((match) => match[1]);
    expect(operationIds).toEqual(expectedOperations);
    expect(new Set(operationIds).size).toBe(operationIds.length);

    const referencedComponents = [
      ...source.matchAll(/\$ref:\s+'#\/components\/(schemas|responses|parameters)\/([^']+)'/g),
    ];
    for (const [, category, name] of referencedComponents) {
      expect(source, `missing OpenAPI ${category} component ${name}`).toMatch(
        new RegExp(`^    ${name}:\\s*$`, "m"),
      );
    }
  });

  it("validates the success response of every JSON operation with its runtime TypeBox schema", async () => {
    const harness = await createFastifyTestHarness({
      build: (dependencies) =>
        buildApp({
          ...dependencies,
          metadataPreviewer: {
            async preview(address) {
              return {
                address,
                status: "complete",
                fallbackTitle: "Example — example.com",
                title: "Example",
                description: "A deterministic preview",
                iconAvailable: false,
                errorCode: null,
              };
            },
          },
        }),
    });
    try {
      const health = await harness.inject({ method: "GET", url: "/api/health" });
      expectSchema(HealthResponseSchema, health.json());

      const preview = await harness.injectJson({
        method: "POST",
        url: "/api/metadata/preview",
        payload: { address: "https://example.com/conformance" },
      });
      expectSchema(MetadataPreviewSchema, preview.json());

      const created = await harness.injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: {
          address: "https://example.com/conformance",
          title: "Conformance bookmark",
          favorite: true,
        },
      });
      expect(created.statusCode).toBe(201);
      expectSchema(BookmarkSchema, created.json());
      const bookmarkId = created.json().id as number;

      const listed = await harness.inject({ method: "GET", url: "/api/bookmarks" });
      expectSchema(BookmarkPageSchema, listed.json());
      const detail = await harness.inject({ method: "GET", url: `/api/bookmarks/${bookmarkId}` });
      expectSchema(BookmarkSchema, detail.json());
      const updated = await harness.injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${bookmarkId}`,
        payload: { description: "Updated through the contract" },
      });
      expectSchema(BookmarkSchema, updated.json());
      const refresh = await harness.injectJson({
        method: "POST",
        url: `/api/bookmarks/${bookmarkId}/metadata-refresh`,
        payload: {},
      });
      expect(refresh.statusCode).toBe(202);
      expectSchema(MetadataRefreshResponseSchema, refresh.json());

      const iconBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      harness.testDatabase.database
        .prepare(
          "INSERT INTO bookmark_icons(content_hash, png_bytes, width, height, byte_length, created_at) VALUES (?, ?, 1, 1, ?, ?)",
        )
        .run(
          "conformance-icon",
          iconBytes,
          iconBytes.byteLength,
          harness.clock.now().toISOString(),
        );
      harness.testDatabase.database
        .prepare("UPDATE bookmarks SET icon_hash = ? WHERE id = ?")
        .run("conformance-icon", bookmarkId);
      const icon = await harness.inject({
        method: "GET",
        url: `/api/bookmarks/${bookmarkId}/icon`,
      });
      expect(icon.statusCode).toBe(200);
      expectSchema(BookmarkIconResponseSchema, icon.body);

      const tags = await harness.inject({ method: "GET", url: "/api/tags" });
      expectSchema(TagSummaryListSchema, tags.json());

      const selection = await harness.injectJson({
        method: "POST",
        url: "/api/selections",
        payload: {
          mode: "ids",
          ids: [bookmarkId],
          criteriaHash: `sha256:${"a".repeat(64)}`,
        },
      });
      expect(selection.statusCode).toBe(201);
      expectSchema(SelectionSchema, selection.json());
      const action = await harness.injectJson({
        method: "POST",
        url: `/api/selections/${selection.json().id}/actions`,
        payload: { type: "mark_unread" },
      });
      expectSchema(BulkResultSchema, action.json());

      const clearedSelection = await harness.injectJson({
        method: "POST",
        url: "/api/selections",
        payload: {
          mode: "ids",
          ids: [bookmarkId],
          criteriaHash: `sha256:${"b".repeat(64)}`,
        },
      });
      const cleared = await harness.inject({
        method: "DELETE",
        url: `/api/selections/${clearedSelection.json().id}`,
      });
      expect(cleared.statusCode).toBe(204);

      const emptyViews = await harness.inject({ method: "GET", url: "/api/saved-views" });
      expectSchema(SavedViewListSchema, emptyViews.json());
      const saved = await harness.injectJson({
        method: "POST",
        url: "/api/saved-views",
        payload: {
          name: "Conformance view",
          scope: "active",
          query: "conformance",
          tags: [],
          favorite: null,
          unread: null,
          sort: "created_desc",
        },
      });
      expectSchema(SavedViewSchema, saved.json());
      const savedId = saved.json().id as number;
      const renamed = await harness.injectJson({
        method: "PATCH",
        url: `/api/saved-views/${savedId}`,
        payload: {
          name: "Renamed conformance view",
          scope: "active",
          query: "conformance",
          tags: [],
          favorite: true,
          unread: null,
          sort: "title_asc",
        },
      });
      expectSchema(SavedViewSchema, renamed.json());
      const removedView = await harness.inject({
        method: "DELETE",
        url: `/api/saved-views/${savedId}`,
      });
      expect(removedView.statusCode).toBe(204);

      const deleted = await harness.inject({
        method: "DELETE",
        url: `/api/bookmarks/${bookmarkId}`,
      });
      expect(deleted.statusCode).toBe(204);
    } finally {
      await harness.close();
    }
  });
});
