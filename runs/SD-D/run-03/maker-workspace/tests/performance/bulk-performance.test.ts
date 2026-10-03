import { performance } from "node:perf_hooks";
import type { AppDatabase } from "../../src/server/db/database.js";
import {
  computeCriteriaHash,
  SelectionRepository,
} from "../../src/server/repositories/selection-repository.js";
import { BulkActionService } from "../../src/server/services/selection/bulk-action-service.js";
import type { BulkAction, SearchCriteria } from "../../src/shared/contracts/api.js";
import { withTestDatabase } from "../helpers/database.js";

const NOW = "2026-09-17T12:00:00.000Z";
const VIEW: SearchCriteria = {
  scope: "active",
  query: "",
  tags: [],
  favorite: null,
  unread: null,
  sort: "created_desc",
};

function seedTenThousand(database: AppDatabase): void {
  const insert = database.prepare(`
    INSERT INTO bookmarks (
      id, address, normalized_address, title, title_sort_key, title_provenance,
      description, description_provenance, metadata_status, note_markdown, note_plain,
      is_favorite, is_unread, archived_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'retrieved', '', 'fallback', 'complete', '', '', 0, 0, NULL, ?, ?)
  `);
  database.transaction(() => {
    for (let id = 1; id <= 10_000; id += 1) {
      const address = `https://example.test/bulk-performance/${id}`;
      const title = `Bulk performance bookmark ${String(id).padStart(5, "0")}`;
      insert.run(id, address, address, title, title.toLowerCase(), NOW, NOW);
    }
  })();
}

function percentile(samples: readonly number[], quantile: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * quantile) - 1] ?? Number.POSITIVE_INFINITY;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

describe("1,000 bookmark bulk performance", () => {
  it("keeps every measured action, including the slowest, under ten seconds", async () => {
    await withTestDatabase(({ database }) => {
      seedTenThousand(database);
      const now = () => new Date(NOW);
      const selections = new SelectionRepository(database, now);
      const bulk = new BulkActionService(database, now);
      const hash = computeCriteriaHash(VIEW);
      const primaryIds = Array.from({ length: 1_000 }, (_, index) => index + 1);
      const samples = new Map<string, number[]>();

      const apply = (name: string, ids: readonly number[], action: BulkAction, measured = true) => {
        const selection = selections.createIds(ids, hash);
        const started = performance.now();
        const result = bulk.apply(selection.id, action);
        const elapsed = performance.now() - started;
        expect(result).toMatchObject({ selectedCount: ids.length, processedCount: ids.length });
        if (measured) samples.set(name, [...(samples.get(name) ?? []), elapsed]);
      };

      for (let iteration = 0; iteration < 5; iteration += 1) {
        const tag = `Performance tag ${iteration}`;
        apply("add_tags", primaryIds, { type: "add_tags", tags: [tag, "Shared performance"] });
        apply("remove_tags_reset", primaryIds, { type: "remove_tags", tags: [tag] }, false);

        apply("add_tags_setup", primaryIds, { type: "add_tags", tags: [tag] }, false);
        apply("remove_tags", primaryIds, { type: "remove_tags", tags: [tag] });

        apply("favorite", primaryIds, { type: "favorite" });
        apply("unfavorite_reset", primaryIds, { type: "unfavorite" }, false);
        apply("unfavorite_setup", primaryIds, { type: "favorite" }, false);
        apply("unfavorite", primaryIds, { type: "unfavorite" });

        apply("mark_unread", primaryIds, { type: "mark_unread" });
        apply("mark_read_reset", primaryIds, { type: "mark_read" }, false);
        apply("mark_read_setup", primaryIds, { type: "mark_unread" }, false);
        apply("mark_read", primaryIds, { type: "mark_read" });

        apply("archive", primaryIds, { type: "archive" });
        apply("restore_reset", primaryIds, { type: "restore" }, false);
        apply("restore_setup", primaryIds, { type: "archive" }, false);
        apply("restore", primaryIds, { type: "restore" });
      }

      for (let sample = 0; sample < 5; sample += 1) {
        const ids = Array.from({ length: 1_000 }, (_, index) => 5_001 + sample * 1_000 + index);
        apply("delete", ids, { type: "delete" });
      }

      const summary = Object.fromEntries(
        [...samples.entries()].map(([name, values]) => [
          name,
          {
            p50Ms: rounded(percentile(values, 0.5)),
            p95Ms: rounded(percentile(values, 0.95)),
            maxMs: rounded(Math.max(...values)),
          },
        ]),
      );
      const slowestP95Ms = Math.max(...Object.values(summary).map(({ p95Ms }) => p95Ms));
      const slowestAction = Object.entries(summary).sort(
        ([, left], [, right]) => right.p95Ms - left.p95Ms,
      )[0]?.[0];
      console.info(
        `PERF_BULK_JSON ${JSON.stringify({ slowestAction, slowestP95Ms, actions: summary })}`,
      );

      expect(slowestP95Ms).toBeLessThan(10_000);
      expect(
        database
          .prepare("SELECT is_favorite, is_unread, archived_at FROM bookmarks WHERE id = 1001")
          .get(),
      ).toEqual({
        is_favorite: 0,
        is_unread: 0,
        archived_at: null,
      });
      expect(
        database
          .prepare("SELECT count(*) AS count FROM bookmark_tags WHERE bookmark_id = 1001")
          .get(),
      ).toEqual({ count: 0 });

      const plans = {
        selectionMembership: database
          .prepare(
            "EXPLAIN QUERY PLAN SELECT bookmark_id FROM selection_items WHERE selection_id = ? ORDER BY bookmark_id",
          )
          .all("opaque-selection-token-not-required-for-plan"),
        bookmarkUpdate: database
          .prepare("EXPLAIN QUERY PLAN UPDATE bookmarks SET is_favorite = 1 WHERE id IN (?, ?, ?)")
          .all(1, 2, 3),
        tagMembership: database
          .prepare(
            "EXPLAIN QUERY PLAN SELECT bookmark_id FROM bookmark_tags WHERE tag_id = ? ORDER BY bookmark_id",
          )
          .all(1),
      };
      console.info(`PERF_BULK_PLANS ${JSON.stringify(plans)}`);
    });
  }, 30_000);
});
