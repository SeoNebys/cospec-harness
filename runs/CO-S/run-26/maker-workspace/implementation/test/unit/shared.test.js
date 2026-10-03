import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidHttpUrl,
  siteFromUrl,
  fallbackTitleFromUrl,
  matchesQuery,
  filterBookmarks,
  tabCounts,
  allTags,
} from "../../public/js/shared.mjs";

function bm(over = {}) {
  return {
    id: over.id || Math.random().toString(36).slice(2),
    url: "https://example.com/a",
    title: "Title",
    site: "example.com",
    description: "",
    tags: [],
    note: "",
    status: "to-read",
    archived: false,
    unreadable: false,
    savedAt: new Date().toISOString(),
    ...over,
  };
}

test("isValidHttpUrl accepts http/https and rejects the rest (SCN-007/008)", () => {
  assert.ok(isValidHttpUrl("https://a.com"));
  assert.ok(isValidHttpUrl("http://a.com/x?y=1"));
  assert.ok(!isValidHttpUrl("not a url"));
  assert.ok(!isValidHttpUrl("ftp://a.com"));
  assert.ok(!isValidHttpUrl("javascript:alert(1)"));
  assert.ok(!isValidHttpUrl(""));
  assert.ok(!isValidHttpUrl(null));
});

test("siteFromUrl strips www", () => {
  assert.equal(siteFromUrl("https://www.example.com/x"), "example.com");
  assert.equal(siteFromUrl("https://sub.example.org/"), "sub.example.org");
});

test("fallbackTitleFromUrl derives a readable title", () => {
  assert.equal(
    fallbackTitleFromUrl("https://example.com/some-cool_article.html"),
    "Some Cool Article"
  );
  assert.equal(fallbackTitleFromUrl("https://example.com/"), "example.com");
});

test("matchesQuery searches title/site/url/tags/description/note (SCN-003)", () => {
  const b = bm({
    title: "Roast Chicken",
    site: "seriouseats.com",
    url: "https://seriouseats.com/food-lab",
    tags: ["cooking"],
    description: "crisp skin science",
    note: "for Sunday dinner",
  });
  assert.ok(matchesQuery(b, "roast")); // title
  assert.ok(matchesQuery(b, "seriouseats")); // site
  assert.ok(matchesQuery(b, "food-lab")); // url
  assert.ok(matchesQuery(b, "cooking")); // tag
  assert.ok(matchesQuery(b, "crisp")); // description
  assert.ok(matchesQuery(b, "sunday")); // note
  assert.ok(matchesQuery(b, "")); // empty matches all
  assert.ok(!matchesQuery(b, "kubernetes"));
});

test("filterBookmarks: everyday tabs exclude archived; archived tab shows only archived (SCN-004/005)", () => {
  const list = [
    bm({ id: "1", status: "to-read", archived: false }),
    bm({ id: "2", status: "finished", archived: false }),
    bm({ id: "3", status: "to-read", archived: true }),
  ];
  assert.deepEqual(filterBookmarks(list, { tab: "all" }).map((b) => b.id), ["1", "2"]);
  assert.deepEqual(filterBookmarks(list, { tab: "to-read" }).map((b) => b.id), ["1"]);
  assert.deepEqual(filterBookmarks(list, { tab: "finished" }).map((b) => b.id), ["2"]);
  assert.deepEqual(filterBookmarks(list, { tab: "archived" }).map((b) => b.id), ["3"]);
});

test("filterBookmarks combines tag + query within a tab (SCN-003)", () => {
  const list = [
    bm({ id: "1", tags: ["react"], title: "hooks" }),
    bm({ id: "2", tags: ["react"], title: "context" }),
    bm({ id: "3", tags: ["vue"], title: "hooks" }),
  ];
  const out = filterBookmarks(list, { tab: "all", tag: "react", query: "hooks" });
  assert.deepEqual(out.map((b) => b.id), ["1"]);
});

test("tabCounts reflect tag/query filters and archived split (SCN-004)", () => {
  const list = [
    bm({ id: "1", status: "to-read", tags: ["x"] }),
    bm({ id: "2", status: "finished", tags: ["x"] }),
    bm({ id: "3", status: "to-read", tags: ["y"] }),
    bm({ id: "4", status: "finished", archived: true, tags: ["x"] }),
  ];
  const c = tabCounts(list, { tag: "x" });
  assert.deepEqual(c, { all: 2, "to-read": 1, finished: 1, archived: 1 });
});

test("allTags returns sorted distinct tags", () => {
  const list = [bm({ tags: ["b", "a"] }), bm({ tags: ["a", "c"] })];
  assert.deepEqual(allTags(list), ["a", "b", "c"]);
});
