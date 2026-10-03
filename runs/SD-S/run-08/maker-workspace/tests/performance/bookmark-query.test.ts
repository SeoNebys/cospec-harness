import assert from "node:assert/strict";
import test from "node:test";
import { listBookmarks } from "../../lib/bookmarks/repository";
import { withTestDatabase } from "../helpers/database";
import { seedBookmarks } from "../helpers/seed";

test("10,000 bookmark first-page queries complete within two seconds for 95% of runs", { timeout: 60_000 }, () => withTestDatabase(async (client) => {
  await seedBookmarks(client);
  const durations: number[] = [];
  for (let run = 0; run < 20; run++) {
    const start = performance.now();
    const page = await listBookmarks({ q: "needle", sort: run % 2 ? "alphabetical" : "newest", limit: 50 }, client);
    durations.push(performance.now() - start);
    assert.ok(page.items.length > 0);
  }
  assert.ok(durations.filter((duration) => duration <= 2_000).length >= 19, `durations: ${durations.join(", ")}`);
}));
