import { Value } from "typebox/value";
import { computeCriteriaHash } from "../../src/server/repositories/selection-repository.js";
import {
  BulkResultSchema,
  type SearchCriteria,
  SelectionSchema,
} from "../../src/shared/contracts/api.js";
import { SearchProblemSchema } from "../../src/shared/contracts/errors.js";
import { withFastifyTestHarness } from "../helpers/fastify.js";

const VIEW: SearchCriteria = {
  scope: "active",
  query: "",
  tags: [],
  favorite: null,
  unread: null,
  sort: "created_desc",
};

async function createBookmark(
  injectJson: Parameters<Parameters<typeof withFastifyTestHarness>[0]>[0]["injectJson"],
  suffix: string,
) {
  return injectJson({
    method: "POST",
    url: "/api/bookmarks",
    payload: { address: `https://example.com/selection-${suffix}` },
  });
}

describe("selection HTTP contract", () => {
  it("creates and clears explicit and all-result selections with exact counts", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const first = await createBookmark(injectJson, "one");
      await createBookmark(injectJson, "two");
      const criteriaHash = computeCriteriaHash(VIEW);
      const explicit = await injectJson({
        method: "POST",
        url: "/api/selections",
        payload: { mode: "ids", ids: [first.json().id], criteriaHash },
      });
      const all = await injectJson({
        method: "POST",
        url: "/api/selections",
        payload: { mode: "all_results", criteria: VIEW, criteriaHash },
      });

      expect(explicit.statusCode).toBe(201);
      expect(Value.Check(SelectionSchema, explicit.json())).toBe(true);
      expect(explicit.json().selectedCount).toBe(1);
      expect(all.statusCode).toBe(201);
      expect(Value.Check(SelectionSchema, all.json())).toBe(true);
      expect(all.json().selectedCount).toBe(2);

      expect(
        (
          await injectJson({
            method: "DELETE",
            url: `/api/selections/${encodeURIComponent(explicit.json().id)}`,
          })
        ).statusCode,
      ).toBe(204);
    });
  });

  it("applies every action variant, returns counts, and consumes the selection", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const first = await createBookmark(injectJson, "actions-one");
      const second = await createBookmark(injectJson, "actions-two");
      const ids = [first.json().id, second.json().id];
      const hash = computeCriteriaHash(VIEW);
      const variants = [
        { type: "add_tags", tags: ["News"] },
        { type: "remove_tags", tags: ["News"] },
        { type: "favorite" },
        { type: "unfavorite" },
        { type: "mark_unread" },
        { type: "mark_read" },
        { type: "archive" },
        { type: "restore" },
      ] as const;

      for (const action of variants) {
        const selection = await injectJson({
          method: "POST",
          url: "/api/selections",
          payload: { mode: "ids", ids, criteriaHash: hash },
        });
        const response = await injectJson({
          method: "POST",
          url: `/api/selections/${encodeURIComponent(selection.json().id)}/actions`,
          payload: action,
        });
        expect(response.statusCode).toBe(200);
        expect(Value.Check(BulkResultSchema, response.json())).toBe(true);
        expect(response.json()).toMatchObject({ selectedCount: 2, processedCount: 2 });
        expect(
          (
            await injectJson({
              method: "POST",
              url: `/api/selections/${encodeURIComponent(selection.json().id)}/actions`,
              payload: action,
            })
          ).statusCode,
        ).toBe(404);
      }

      const deleted = await createBookmark(injectJson, "delete-action");
      const deletionSelection = await injectJson({
        method: "POST",
        url: "/api/selections",
        payload: { mode: "ids", ids: [deleted.json().id], criteriaHash: hash },
      });
      const deletion = await injectJson({
        method: "POST",
        url: `/api/selections/${encodeURIComponent(deletionSelection.json().id)}/actions`,
        payload: { type: "delete" },
      });
      expect(deletion.statusCode).toBe(200);
      expect(deletion.json()).toEqual({ selectedCount: 1, processedCount: 1, changedCount: 1 });
    });
  });

  it("returns 409 for an expired selection and 422 for a mismatched criteria hash", async () => {
    await withFastifyTestHarness(async ({ injectJson, clock }) => {
      await createBookmark(injectJson, "expiry");
      const mismatch = await injectJson({
        method: "POST",
        url: "/api/selections",
        payload: { mode: "all_results", criteria: VIEW, criteriaHash: "sha256:wrong" },
      });
      expect(mismatch.statusCode).toBe(422);
      expect(Value.Check(SearchProblemSchema, mismatch.json())).toBe(true);

      const selection = await injectJson({
        method: "POST",
        url: "/api/selections",
        payload: { mode: "all_results", criteria: VIEW, criteriaHash: computeCriteriaHash(VIEW) },
      });
      clock.advance({ hours: 1 });
      const expired = await injectJson({
        method: "POST",
        url: `/api/selections/${encodeURIComponent(selection.json().id)}/actions`,
        payload: { type: "delete" },
      });
      expect(expired.statusCode).toBe(409);
      expect(expired.json()).toMatchObject({ code: "SELECTION_EXPIRED" });
    });
  });
});
