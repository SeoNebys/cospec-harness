import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureScheme, hostOf, isPlausibleUrl, normalizeUrl, findDuplicate,
  normalizeTag, addTag, removeTag, allTags, matchesSearch, matchesTags, visibleLinks,
} from "../../public/logic.js";

test("ensureScheme adds https when missing (SCN-008)", () => {
  assert.equal(ensureScheme("example.com/x"), "https://example.com/x");
  assert.equal(ensureScheme("http://a.com"), "http://a.com");
  assert.equal(ensureScheme("HTTPS://a.com"), "HTTPS://a.com");
});

test("isPlausibleUrl accepts domains, rejects plain text (SCN-008)", () => {
  assert.equal(isPlausibleUrl("example.com"), true);
  assert.equal(isPlausibleUrl("https://sub.example.co.uk/path?q=1"), true);
  assert.equal(isPlausibleUrl("dinner ideas"), false);
  assert.equal(isPlausibleUrl("localhost"), false);
  assert.equal(isPlausibleUrl(""), false);
});

test("normalizeUrl ignores trailing slash and case for duplicates (SCN-008)", () => {
  assert.equal(normalizeUrl("https://Example.com/A/"), normalizeUrl("https://example.com/A"));
  assert.equal(normalizeUrl("https://www.example.com/"), normalizeUrl("https://example.com"));
});

test("findDuplicate matches normalised addresses (SCN-008)", () => {
  const links = [{ url: "https://example.com/a" }];
  assert.ok(findDuplicate(links, "https://example.com/a/"));
  assert.ok(findDuplicate(links, "example.com/a"));
  assert.equal(findDuplicate(links, "https://example.com/b"), null);
});

test("hostOf strips www and lowercases", () => {
  assert.equal(hostOf("https://www.NYTimes.com/x"), "nytimes.com");
});

test("tag normalisation and dedup (SCN-002)", () => {
  assert.equal(normalizeTag("  #Reading "), "reading");
  assert.deepEqual(addTag(["reading"], "reading"), ["reading"]); // no duplicate
  assert.deepEqual(addTag(["reading"], "#AI"), ["reading", "ai"]);
  assert.deepEqual(addTag(["reading"], "   "), ["reading"]); // empty ignored
  assert.deepEqual(removeTag(["reading", "ai"], "ai"), ["reading"]);
});

test("allTags collects a sorted shared vocabulary (SCN-002)", () => {
  const links = [{ tags: ["reading", "ai"] }, { tags: ["ai", "finance"] }];
  assert.deepEqual(allTags(links), ["ai", "finance", "reading"]);
});

test("matchesSearch spans title, description, tags, url, note (SCN-005)", () => {
  const link = {
    title: "Best Pasta", description: "weeknight dinner", tags: ["recipes"],
    url: "https://seriouseats.com/best-pasta", note: "the one Mara sent me",
  };
  assert.equal(matchesSearch(link, "pasta"), true); // title
  assert.equal(matchesSearch(link, "dinner"), true); // description
  assert.equal(matchesSearch(link, "recipes"), true); // tag
  assert.equal(matchesSearch(link, "seriouseats"), true); // url
  assert.equal(matchesSearch(link, "mara"), true); // note
  assert.equal(matchesSearch(link, "pasta mara"), true); // AND, both present
  assert.equal(matchesSearch(link, "pasta zzz"), false); // AND, one absent
  assert.equal(matchesSearch(link, ""), true);
});

test("matchesTags requires all active tags (SCN-005)", () => {
  const link = { tags: ["ai", "reading"] };
  assert.equal(matchesTags(link, ["ai"]), true);
  assert.equal(matchesTags(link, ["ai", "reading"]), true);
  assert.equal(matchesTags(link, ["ai", "finance"]), false);
  assert.equal(matchesTags(link, []), true);
});

test("visibleLinks: reading-list view, search+tag combine, newest first (SCN-003/005/009)", () => {
  const links = [
    { id: "a", title: "Alpha", tags: ["x"], inList: true, savedAt: 1, url: "", note: "", description: "" },
    { id: "b", title: "Beta", tags: ["x", "y"], inList: false, savedAt: 3, url: "", note: "", description: "" },
    { id: "c", title: "Gamma", tags: ["y"], inList: true, savedAt: 2, url: "", note: "", description: "" },
  ];
  // all view newest first
  assert.deepEqual(visibleLinks(links, { view: "all" }).map((l) => l.id), ["b", "c", "a"]);
  // reading list only
  assert.deepEqual(visibleLinks(links, { view: "list" }).map((l) => l.id), ["c", "a"]);
  // tag filter
  assert.deepEqual(visibleLinks(links, { view: "all", tagFilters: ["x"] }).map((l) => l.id), ["b", "a"]);
  // combine tag + search
  assert.deepEqual(
    visibleLinks(links, { view: "all", tagFilters: ["x"], q: "beta" }).map((l) => l.id),
    ["b"]
  );
});
