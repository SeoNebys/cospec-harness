import assert from "node:assert/strict";
import test from "node:test";
import { createBookmark, deleteBookmark, getBookmark, updateBookmark } from "../../lib/bookmarks/repository";
import { AppError } from "../../lib/errors";
import { withTestDatabase } from "../helpers/database";

const write = { url: "example.com/guide#part", title: "A guide", titleOrigin: "fetched" as const, note: "Read it", tags: ["Work"] };

test("CRUD is persistent and canonical URLs are unique", () => withTestDatabase(async (client) => {
  const created = await createBookmark(write, client);
  assert.equal(created.url, "https://example.com/guide");
  assert.deepEqual(created.tags, ["Work"]);
  await assert.rejects(createBookmark({ ...write, url: "https://EXAMPLE.com/guide" }, client), (error: unknown) => error instanceof AppError && error.code === "DUPLICATE_URL" && error.existingId === created.id);
  const updated = await updateBookmark(created.id, { ...write, title: "My guide", titleOrigin: "user", tags: ["work", "Research"] }, client);
  assert.equal(updated.titleOrigin, "user");
  assert.deepEqual(updated.tags, ["Research", "Work"]);
  assert.equal((await getBookmark(created.id, client))?.title, "My guide");
  await updateBookmark(created.id, { ...write, title: "Fetched replacement", titleOrigin: "fetched", tags: [] }, client);
  assert.equal((await getBookmark(created.id, client))?.title, "My guide");
  await deleteBookmark(created.id, client);
  assert.equal(await getBookmark(created.id, client), null);
  assert.equal(await client.tag.count(), 0);
}));

test("invalid tag change rolls back visible fields", () => withTestDatabase(async (client) => {
  const created = await createBookmark(write, client);
  await assert.rejects(updateBookmark(created.id, { ...write, title: "Should rollback", tags: ["x".repeat(51)] }, client));
  assert.equal((await getBookmark(created.id, client))?.title, "A guide");
}));
