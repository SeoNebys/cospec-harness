import assert from "node:assert/strict";
import test from "node:test";
import { createBookmark, updateBookmark } from "../../lib/bookmarks/repository";
import { listTags } from "../../lib/tags/repository";
import { withTestDatabase } from "../helpers/database";

test("tags reuse normalized identity, retain first spelling, count, and clean orphans", () => withTestDatabase(async (client) => {
  const common = { titleOrigin: "user" as const, note: "", iconToken: null };
  const one = await createBookmark({ ...common, url: "https://one.example", title: "One", tags: [" Work  Notes "] }, client);
  const two = await createBookmark({ ...common, url: "https://two.example", title: "Two", tags: ["work notes"] }, client);
  assert.deepEqual(await listTags(client), [{ id: 1, name: "Work Notes", count: 2 }]);
  await updateBookmark(one.id, { ...common, url: one.url, title: one.title, tags: [] }, client);
  assert.equal((await listTags(client))[0]?.count, 1);
  await updateBookmark(two.id, { ...common, url: two.url, title: two.title, tags: [] }, client);
  assert.deepEqual(await listTags(client), []);
}));
