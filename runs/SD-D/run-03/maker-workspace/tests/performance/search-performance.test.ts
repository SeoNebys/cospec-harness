import { performance } from "node:perf_hooks";
import type { AppDatabase } from "../../src/server/db/database.js";
import {
  SearchRepository,
  type SearchRequest,
} from "../../src/server/repositories/search-repository.js";
import { withTestDatabase } from "../helpers/database.js";

const CREATED = "2026-09-17T12:00:00.000Z";

function criteria(overrides: Partial<SearchRequest> = {}): SearchRequest {
  return {
    scope: "active",
    query: "",
    tags: [],
    favorite: null,
    unread: null,
    sort: "created_desc",
    limit: 50,
    ...overrides,
  };
}

function seedTenThousand(database: AppDatabase): void {
  const insertBookmark = database.prepare(`
    INSERT INTO bookmarks (
      id, address, normalized_address, title, title_sort_key, title_provenance,
      description, description_provenance, metadata_status, note_markdown, note_plain,
      is_favorite, is_unread, archived_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'retrieved', ?, 'retrieved', 'complete', '', ?, ?, ?, ?, ?, ?)
  `);
  const insertTag = database.prepare(
    "INSERT OR IGNORE INTO tags(display_name, name_key, created_at) VALUES (?, ?, ?)",
  );
  const attachTag = database.prepare(`
    INSERT INTO bookmark_tags(bookmark_id, tag_id)
    SELECT ?, id FROM tags WHERE name_key = ?
  `);

  database.transaction(() => {
    insertTag.run("Research", "research", CREATED);
    insertTag.run("Machine Learning", "machine learning", CREATED);
    for (let id = 1; id <= 10_000; id += 1) {
      const rare = id === 7 ? "quasarneedle" : "";
      const phrase = id % 211 === 0 ? "distributed systems" : "reference material";
      const title = `Bookmark ${String(id).padStart(5, "0")} common ${rare}`;
      const address = `https://example.test/library/${id}`;
      const createdAt = new Date(Date.parse(CREATED) - id * 1000).toISOString();
      insertBookmark.run(
        id,
        address,
        address,
        title,
        title.toLowerCase(),
        phrase,
        id % 17 === 0 ? "ui notes" : "long form notes",
        id % 2,
        id % 3 === 0 ? 1 : 0,
        id % 19 === 0 ? CREATED : null,
        createdAt,
        createdAt,
      );
      if (id % 5 === 0) attachTag.run(id, "research");
      if (id % 13 === 0) attachTag.run(id, "machine learning");
    }
  })();
}

function percentile95(samples: number[]): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

describe("10,000 bookmark search performance", () => {
  it("returns total count and first page under the one-second p95 target", async () => {
    await withTestDatabase(({ database }) => {
      seedTenThousand(database);
      const repository = new SearchRepository(database);
      const operations: Array<{ name: string; request: SearchRequest }> = [
        { name: "rare_trigram", request: criteria({ query: "quasarneedle" }) },
        { name: "common_trigram", request: criteria({ query: "common" }) },
        { name: "short_atom", request: criteria({ query: "ui" }) },
        { name: "phrase", request: criteria({ query: '"distributed systems"' }) },
        {
          name: "five_atom_and",
          request: criteria({ query: "common material notes example library" }),
        },
        {
          name: "exact_and_filter_tags",
          request: criteria({ query: "#research", tags: ["machine learning"] }),
        },
        {
          name: "tag_favorite_created_asc",
          request: criteria({ tags: ["research"], favorite: true, sort: "created_asc" }),
        },
        { name: "unread_updated_desc", request: criteria({ unread: true, sort: "updated_desc" }) },
        { name: "title_sort", request: criteria({ sort: "title_asc" }) },
      ];

      const timings = new Map<string, number[]>();
      for (let iteration = 0; iteration < 5; iteration += 1) {
        for (const operation of operations) {
          const started = performance.now();
          const page = repository.search(operation.request);
          const samples = timings.get(operation.name) ?? [];
          samples.push(performance.now() - started);
          timings.set(operation.name, samples);
          expect(page.items.length).toBeLessThanOrEqual(50);
          expect(page.total).toBeGreaterThanOrEqual(page.items.length);
        }
      }

      const rare = repository.search(criteria({ query: "quasarneedle" }));
      expect(rare.total).toBe(1);
      expect(rare.items[0]?.id).toBe(7);
      const allSamples = [...timings.values()].flat();
      const result = {
        overallP95Ms: rounded(percentile95(allSamples)),
        operations: Object.fromEntries(
          [...timings.entries()].map(([name, samples]) => [
            name,
            {
              p50Ms: rounded(
                [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)] ?? 0,
              ),
              p95Ms: rounded(percentile95(samples)),
              maxMs: rounded(Math.max(...samples)),
            },
          ]),
        ),
      };
      console.info(`PERF_SEARCH_JSON ${JSON.stringify(result)}`);
      expect(result.overallP95Ms).toBeLessThan(1_000);

      const plans = {
        trigram: database
          .prepare(
            "EXPLAIN QUERY PLAN SELECT rowid FROM bookmark_search WHERE bookmark_search MATCH ?",
          )
          .all('"common"'),
        scopeSort: database
          .prepare(
            "EXPLAIN QUERY PLAN SELECT id FROM bookmarks WHERE archived_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 51",
          )
          .all(),
        tagFilter: database
          .prepare(`
            EXPLAIN QUERY PLAN
            SELECT bt.bookmark_id
            FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id
            WHERE t.name_key = ?
          `)
          .all("research"),
      };
      console.info(`PERF_SEARCH_PLANS ${JSON.stringify(plans)}`);
    });
  }, 30_000);
});
