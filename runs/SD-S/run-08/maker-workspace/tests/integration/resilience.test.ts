import assert from "node:assert/strict";
import test from "node:test";
import { createBookmark, getBookmark, updateBookmark } from "../../lib/bookmarks/repository";
import { AppError } from "../../lib/errors";
import { withTestDatabase } from "../helpers/database";

test("concurrent duplicate writes leave one bookmark and report the winner", () => withTestDatabase(async (client) => {
  const input = { url: "https://example.com/race", title: "Race", titleOrigin: "fetched" as const, note: "", tags: [] };
  const results = await Promise.allSettled([createBookmark(input, client), createBookmark(input, client)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  assert.ok(rejected?.reason instanceof AppError);
  assert.equal(rejected.reason.code, "DUPLICATE_URL");
  assert.equal(await client.bookmark.count(), 1);
}));

test("metadata-style updates cannot overwrite a user-owned title", () => withTestDatabase(async (client) => {
  const original = await createBookmark({ url: "https://example.com", title: "My title", titleOrigin: "user", note: "", tags: [] }, client);
  await Promise.all([
    updateBookmark(original.id, { url: original.url, title: "Fetched one", titleOrigin: "fetched", note: "", tags: [] }, client),
    updateBookmark(original.id, { url: original.url, title: "Fallback two", titleOrigin: "fallback", note: "", tags: [] }, client),
  ]);
  assert.equal((await getBookmark(original.id, client))?.title, "My title");
}));
