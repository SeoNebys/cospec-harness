import assert from "node:assert/strict";
import test from "node:test";
import { createBookmark, listBookmarks } from "../../lib/bookmarks/repository";
import { withTestDatabase } from "../helpers/database";

test("search combines fields and tag filter with stable sorting and cursors", () => withTestDatabase(async (client) => {
  const common = { titleOrigin: "user" as const, iconToken: null };
  await createBookmark({ ...common, url: "https://one.example/cafe", title: "Ｃafé Alpha", note: "first", tags: ["Reading"] }, client);
  await new Promise((resolve) => setTimeout(resolve, 2));
  await createBookmark({ ...common, url: "https://two.example", title: "Beta 100%", note: "café note", tags: ["Reading"] }, client);
  await createBookmark({ ...common, url: "https://three.example", title: "Gamma", note: "", tags: ["Other"] }, client);
  const first = await listBookmarks({ q: "CAFÉ", tag: "reading", sort: "alphabetical", limit: 1 }, client);
  assert.equal(first.items[0]?.title, "Beta 100%");
  assert.ok(first.nextCursor);
  const second = await listBookmarks({ q: "CAFÉ", tag: "READING", sort: "alphabetical", limit: 1, cursor: first.nextCursor! }, client);
  assert.equal(second.items[0]?.title, "Ｃafé Alpha");
  const literal = await listBookmarks({ q: "100%", sort: "newest", limit: 50 }, client);
  assert.equal(literal.items.length, 1);
  await assert.rejects(listBookmarks({ q: "", sort: "newest", limit: 50, cursor: "bad" }, client));
}));
