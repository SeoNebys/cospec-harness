import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, ensureDatabase } from "@/lib/db/client";
import { listBookmarks } from "@/lib/dal/bookmarks";

const ownerId = "performance-owner";
beforeAll(async () => {
  await ensureDatabase();
  await client.query("INSERT INTO users (id,name,email,password_hash) VALUES ($1,'Performance','performance@example.test','unused') ON CONFLICT DO NOTHING", [ownerId]);
  await client.query(`INSERT INTO bookmarks (id,owner_id,title,url,normalized_url)
    SELECT 'perf-' || n, $1, 'Reference ' || n, 'https://example.test/' || n, 'https://example.test/' || n
    FROM generate_series(1,10000) n ON CONFLICT DO NOTHING`, [ownerId]);
});
afterAll(async () => { await client.query("DELETE FROM users WHERE id = $1", [ownerId]); });

describe("10,000-bookmark retrieval", () => {
  it("returns filtered results under the one-second target in at least 95% of samples", async () => {
    const timings: number[] = [];
    for (let index = 0; index < 20; index++) { const start = performance.now(); const result = await listBookmarks(ownerId, `Reference ${9000 + index}`, "", 50); timings.push(performance.now() - start); expect(result.total).toBeGreaterThan(0); }
    expect(timings.filter((time) => time < 1000).length).toBeGreaterThanOrEqual(19);
  }, 60_000);
});
