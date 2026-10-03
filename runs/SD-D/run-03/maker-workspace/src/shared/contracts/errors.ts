import { type Static, type TSchema, Type } from "typebox";

import { ScopeSchema } from "./api.js";

function inline<T extends TSchema>(schema: T): T {
  const copy = { ...schema } as T & { $id?: string };
  delete copy.$id;
  return copy;
}

/** Base error payload used by validation, not-found, and selection errors. */
export const ProblemSchema = Type.Object(
  {
    code: Type.String(),
    message: Type.String(),
    field: Type.Optional(Type.String()),
  },
  { $id: "Problem" },
);
export type Problem = Static<typeof ProblemSchema>;

/** Position-aware error returned for invalid search syntax or criteria. */
export const SearchProblemSchema = Type.Object(
  {
    code: Type.String(),
    message: Type.String(),
    field: Type.Optional(Type.String()),
    start: Type.Integer({ minimum: 0 }),
    end: Type.Integer({ minimum: 0 }),
    hint: Type.String(),
  },
  { $id: "SearchProblem" },
);
export type SearchProblem = Static<typeof SearchProblemSchema>;

/** Conflict payload that directs the client to the existing bookmark editor. */
export const DuplicateBookmarkProblemSchema = Type.Object(
  {
    code: Type.Literal("DUPLICATE_BOOKMARK"),
    message: Type.String(),
    field: Type.Optional(Type.String()),
    existingBookmarkId: Type.Integer(),
    existingScope: Type.Optional(inline(ScopeSchema)),
  },
  { $id: "DuplicateBookmarkProblem" },
);
export type DuplicateBookmarkProblem = Static<typeof DuplicateBookmarkProblemSchema>;

/** Conflict payload returned for a normalized duplicate saved-view name. */
export const DuplicateSavedViewProblemSchema = Type.Object(
  {
    code: Type.Literal("DUPLICATE_SAVED_VIEW_NAME"),
    message: Type.String(),
    field: Type.Optional(Type.Literal("name")),
  },
  { $id: "DuplicateSavedViewProblem" },
);
export type DuplicateSavedViewProblem = Static<typeof DuplicateSavedViewProblemSchema>;

export const errorSchemas = [
  ProblemSchema,
  SearchProblemSchema,
  DuplicateBookmarkProblemSchema,
  DuplicateSavedViewProblemSchema,
] as const;
