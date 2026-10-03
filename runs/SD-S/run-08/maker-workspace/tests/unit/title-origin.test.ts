import assert from "node:assert/strict";
import test from "node:test";
import { titleOriginAfterEdit } from "../../lib/metadata/service.js";

test("preserves provenance when the title is unchanged", () => {
  assert.equal(titleOriginAfterEdit("fetched", "Page", " Page "), "fetched");
  assert.equal(titleOriginAfterEdit("fallback", "example.com", "example.com"), "fallback");
});

test("a user title edit permanently changes origin to user", () => {
  assert.equal(titleOriginAfterEdit("fetched", "Page", "My page"), "user");
  assert.equal(titleOriginAfterEdit("user", "Mine", "Changed again"), "user");
});

