import { Value } from "typebox/value";

import {
  SavedViewListSchema,
  SavedViewSchema,
  type SavedViewWrite,
} from "../../src/shared/contracts/api.js";
import {
  DuplicateSavedViewProblemSchema,
  ProblemSchema,
  SearchProblemSchema,
} from "../../src/shared/contracts/errors.js";
import { withFastifyTestHarness } from "../helpers/fastify.js";

function payload(overrides: Partial<SavedViewWrite> = {}): SavedViewWrite {
  return {
    name: "Research queue",
    query: 'climate AND "deep dive"',
    tags: ["Research", "Long form"],
    scope: "read_later",
    favorite: true,
    unread: true,
    sort: "updated_desc",
    ...overrides,
  };
}

describe("saved-view HTTP contract", () => {
  it("lists, creates, updates, and deletes full live criteria definitions", async () => {
    await withFastifyTestHarness(async ({ injectJson, clock }) => {
      const initiallyEmpty = await injectJson({ method: "GET", url: "/api/saved-views" });
      expect(initiallyEmpty.statusCode).toBe(200);
      expect(Value.Check(SavedViewListSchema, initiallyEmpty.json())).toBe(true);
      expect(initiallyEmpty.json()).toEqual([]);

      const created = await injectJson({
        method: "POST",
        url: "/api/saved-views",
        payload: payload(),
      });
      expect(created.statusCode).toBe(201);
      expect(Value.Check(SavedViewSchema, created.json())).toBe(true);
      expect(created.json()).toMatchObject({
        ...payload(),
        tags: ["Long form", "Research"],
        grammarVersion: 1,
        createdAt: clock.iso(),
        updatedAt: clock.iso(),
      });

      clock.advance({ minutes: 1 });
      const replacement = payload({
        name: "Archive audit",
        query: "#news OR beta",
        tags: ["Missing tag"],
        scope: "archived",
        favorite: null,
        unread: false,
        sort: "title_asc",
      });
      const updated = await injectJson({
        method: "PATCH",
        url: `/api/saved-views/${created.json().id}`,
        payload: replacement,
      });
      expect(updated.statusCode).toBe(200);
      expect(Value.Check(SavedViewSchema, updated.json())).toBe(true);
      expect(updated.json()).toMatchObject({
        ...replacement,
        id: created.json().id,
        grammarVersion: 1,
        createdAt: created.json().createdAt,
        updatedAt: clock.iso(),
      });

      const listed = await injectJson({ method: "GET", url: "/api/saved-views" });
      expect(Value.Check(SavedViewListSchema, listed.json())).toBe(true);
      expect(listed.json()).toEqual([updated.json()]);

      const removed = await injectJson({
        method: "DELETE",
        url: `/api/saved-views/${created.json().id}`,
      });
      expect(removed.statusCode).toBe(204);
      expect(removed.body).toBe("");

      const missing = await injectJson({
        method: "PATCH",
        url: `/api/saved-views/${created.json().id}`,
        payload: replacement,
      });
      expect(missing.statusCode).toBe(404);
      expect(Value.Check(ProblemSchema, missing.json())).toBe(true);
    });
  });

  it("returns a normalized duplicate-name conflict without changing either view", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const first = await injectJson({
        method: "POST",
        url: "/api/saved-views",
        payload: payload({ name: "  Ｒｅａｄｉｎｇ Queue  " }),
      });
      const duplicate = await injectJson({
        method: "POST",
        url: "/api/saved-views",
        payload: payload({ name: "reading QUEUE", query: "different", tags: [] }),
      });

      expect(first.statusCode).toBe(201);
      expect(duplicate.statusCode).toBe(409);
      expect(Value.Check(DuplicateSavedViewProblemSchema, duplicate.json())).toBe(true);
      expect(duplicate.json()).toEqual({
        code: "DUPLICATE_SAVED_VIEW_NAME",
        message: "A saved view with that name already exists.",
        field: "name",
      });

      const listed = await injectJson({ method: "GET", url: "/api/saved-views" });
      expect(listed.json()).toHaveLength(1);
      expect(listed.json()[0]).toMatchObject({ id: first.json().id, query: payload().query });
    });
  });

  it("returns position-aware syntax guidance and does not persist an invalid view", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const response = await injectJson({
        method: "POST",
        url: "/api/saved-views",
        payload: payload({ query: "alpha AND OR beta" }),
      });

      expect(response.statusCode).toBe(422);
      expect(Value.Check(SearchProblemSchema, response.json())).toBe(true);
      expect(response.json()).toEqual({
        code: "DOUBLE_OPERATOR",
        message: "Two operators cannot appear together.",
        field: "query",
        start: 10,
        end: 12,
        hint: "Remove one operator or add a term between them",
      });

      const listed = await injectJson({ method: "GET", url: "/api/saved-views" });
      expect(listed.json()).toEqual([]);
    });
  });

  it("returns actionable validation for an all-whitespace name", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const response = await injectJson({
        method: "POST",
        url: "/api/saved-views",
        payload: payload({ name: "   " }),
      });

      expect(response.statusCode).toBe(422);
      expect(Value.Check(SearchProblemSchema, response.json())).toBe(true);
      expect(response.json()).toMatchObject({
        code: "INVALID_SAVED_VIEW_NAME",
        field: "name",
        start: 0,
        end: 3,
      });
    });
  });
});
