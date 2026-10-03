import { type Static, type TSchema, Type } from "typebox";

function inline<T extends TSchema>(schema: T): T {
  const copy = { ...schema } as T & { $id?: string };
  delete copy.$id;
  return copy;
}

/**
 * Shared JSON schemas for the successful request and response bodies in the
 * approved OpenAPI contract. These values are suitable for Fastify runtime
 * validation and their corresponding types are shared with the client.
 */

export const ScopeSchema = Type.Union(
  [Type.Literal("active"), Type.Literal("read_later"), Type.Literal("archived")],
  { $id: "Scope", default: "active" },
);
export type Scope = Static<typeof ScopeSchema>;

export const SortOrderSchema = Type.Union(
  [
    Type.Literal("created_desc"),
    Type.Literal("created_asc"),
    Type.Literal("updated_desc"),
    Type.Literal("title_asc"),
  ],
  { $id: "SortOrder", default: "created_desc" },
);
export type SortOrder = Static<typeof SortOrderSchema>;

export const MetadataStatusSchema = Type.Union(
  [
    Type.Literal("pending"),
    Type.Literal("complete"),
    Type.Literal("partial"),
    Type.Literal("failed"),
    Type.Literal("skipped_unsafe"),
  ],
  { $id: "MetadataStatus" },
);
export type MetadataStatus = Static<typeof MetadataStatusSchema>;

export const ProvenanceSchema = Type.Union(
  [Type.Literal("fallback"), Type.Literal("retrieved"), Type.Literal("user")],
  { $id: "Provenance" },
);
export type Provenance = Static<typeof ProvenanceSchema>;

export const BookmarkIdParamsSchema = Type.Object(
  { bookmarkId: Type.Integer() },
  { $id: "BookmarkIdParams", additionalProperties: false },
);
export type BookmarkIdParams = Static<typeof BookmarkIdParamsSchema>;

export const SavedViewIdParamsSchema = Type.Object(
  { savedViewId: Type.Integer() },
  { $id: "SavedViewIdParams", additionalProperties: false },
);
export type SavedViewIdParams = Static<typeof SavedViewIdParamsSchema>;

export const SelectionIdParamsSchema = Type.Object(
  { selectionId: Type.String() },
  { $id: "SelectionIdParams", additionalProperties: false },
);
export type SelectionIdParams = Static<typeof SelectionIdParamsSchema>;

export const HealthResponseSchema = Type.Object(
  { status: Type.Literal("ready") },
  { $id: "HealthResponse", additionalProperties: false },
);
export type HealthResponse = Static<typeof HealthResponseSchema>;

export const TagSchema = Type.Object(
  {
    id: Type.Integer(),
    name: Type.String(),
  },
  { $id: "Tag", additionalProperties: false },
);
export type Tag = Static<typeof TagSchema>;

export const TagSummarySchema = Type.Object(
  {
    id: Type.Integer(),
    name: Type.String(),
    activeBookmarkCount: Type.Integer({ minimum: 0 }),
  },
  { $id: "TagSummary", additionalProperties: false },
);
export type TagSummary = Static<typeof TagSummarySchema>;

export const TagSummaryListSchema = Type.Array(inline(TagSummarySchema), {
  $id: "TagSummaryList",
});
export type TagSummaryList = Static<typeof TagSummaryListSchema>;

export const BookmarkSchema = Type.Object(
  {
    id: Type.Integer(),
    address: Type.String({ format: "uri" }),
    title: Type.String(),
    titleProvenance: inline(ProvenanceSchema),
    retrievedTitleCandidate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    description: Type.String(),
    descriptionProvenance: inline(ProvenanceSchema),
    retrievedDescriptionCandidate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    iconUrl: Type.Union([Type.String(), Type.Null()]),
    metadataStatus: inline(MetadataStatusSchema),
    metadataErrorCode: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    noteMarkdown: Type.String(),
    tags: Type.Array(inline(TagSchema)),
    favorite: Type.Boolean(),
    unread: Type.Boolean(),
    archived: Type.Boolean(),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
  },
  { $id: "Bookmark", additionalProperties: false },
);
export type Bookmark = Static<typeof BookmarkSchema>;

export const BookmarkCreateSchema = Type.Object(
  {
    address: Type.String(),
    title: Type.Optional(
      Type.String({
        description: "Omit unless the user manually overrides the automatic/fallback title.",
      }),
    ),
    description: Type.Optional(
      Type.String({
        description: "Omit unless the user manually overrides the automatic description.",
      }),
    ),
    noteMarkdown: Type.Optional(Type.String({ default: "" })),
    tags: Type.Optional(Type.Array(Type.String(), { uniqueItems: true })),
    favorite: Type.Optional(Type.Boolean({ default: false })),
    unread: Type.Optional(Type.Boolean({ default: false })),
  },
  { $id: "BookmarkCreate", additionalProperties: false },
);
export type BookmarkCreate = Static<typeof BookmarkCreateSchema>;

export const BookmarkPatchSchema = Type.Object(
  {
    address: Type.Optional(Type.String()),
    title: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    noteMarkdown: Type.Optional(Type.String()),
    tags: Type.Optional(Type.Array(Type.String(), { uniqueItems: true })),
    favorite: Type.Optional(Type.Boolean()),
    unread: Type.Optional(Type.Boolean()),
    archived: Type.Optional(Type.Boolean()),
    acceptRetrievedTitle: Type.Optional(Type.Boolean()),
    acceptRetrievedDescription: Type.Optional(Type.Boolean()),
  },
  { $id: "BookmarkPatch", additionalProperties: false, minProperties: 1 },
);
export type BookmarkPatch = Static<typeof BookmarkPatchSchema>;

export const MetadataPreviewRequestSchema = Type.Object(
  { address: Type.String() },
  { $id: "MetadataPreviewRequest", additionalProperties: false },
);
export type MetadataPreviewRequest = Static<typeof MetadataPreviewRequestSchema>;

export const MetadataPreviewSchema = Type.Object(
  {
    address: Type.String(),
    status: inline(MetadataStatusSchema),
    fallbackTitle: Type.String(),
    title: Type.String(),
    description: Type.String(),
    iconAvailable: Type.Boolean(),
    errorCode: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  },
  { $id: "MetadataPreview", additionalProperties: false },
);
export type MetadataPreview = Static<typeof MetadataPreviewSchema>;

export const BookmarkPageSchema = Type.Object(
  {
    items: Type.Array(inline(BookmarkSchema)),
    total: Type.Integer({ minimum: 0 }),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
  },
  { $id: "BookmarkPage", additionalProperties: false },
);
export type BookmarkPage = Static<typeof BookmarkPageSchema>;

export const BookmarkListQuerySchema = Type.Object(
  {
    scope: Type.Optional(inline(ScopeSchema)),
    q: Type.Optional(Type.String({ default: "" })),
    tag: Type.Optional(Type.Array(Type.String())),
    favorite: Type.Optional(Type.Boolean()),
    unread: Type.Optional(Type.Boolean()),
    sort: Type.Optional(inline(SortOrderSchema)),
    cursor: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
  },
  { $id: "BookmarkListQuery", additionalProperties: false },
);
export type BookmarkListQuery = Static<typeof BookmarkListQuerySchema>;

export const MetadataRefreshResponseSchema = Type.Object(
  {
    bookmarkId: Type.Integer(),
    metadataStatus: Type.Literal("pending"),
  },
  { $id: "MetadataRefreshResponse", additionalProperties: false },
);
export type MetadataRefreshResponse = Static<typeof MetadataRefreshResponseSchema>;

export const BookmarkIconResponseSchema = Type.String({
  $id: "BookmarkIconResponse",
  contentEncoding: "binary",
});
export type BookmarkIconResponse = Static<typeof BookmarkIconResponseSchema>;

export const BookmarkIconHeadersSchema = Type.Object(
  { "X-Content-Type-Options": Type.Literal("nosniff") },
  { $id: "BookmarkIconHeaders", additionalProperties: false },
);
export type BookmarkIconHeaders = Static<typeof BookmarkIconHeadersSchema>;

export const SearchCriteriaSchema = Type.Object(
  {
    scope: inline(ScopeSchema),
    query: Type.String(),
    tags: Type.Array(Type.String(), { uniqueItems: true }),
    favorite: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    unread: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    sort: inline(SortOrderSchema),
  },
  { $id: "SearchCriteria", additionalProperties: false },
);
export type SearchCriteria = Static<typeof SearchCriteriaSchema>;

export const SelectionCreateSchema = Type.Union(
  [
    Type.Object(
      {
        mode: Type.Literal("ids"),
        ids: Type.Array(Type.Integer(), { minItems: 1, uniqueItems: true }),
        criteriaHash: Type.String(),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        mode: Type.Literal("all_results"),
        criteria: inline(SearchCriteriaSchema),
        criteriaHash: Type.String(),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "SelectionCreate" },
);
export type SelectionCreate = Static<typeof SelectionCreateSchema>;

export const SelectionSchema = Type.Object(
  {
    id: Type.String(),
    selectedCount: Type.Integer({ minimum: 1 }),
    criteriaHash: Type.String(),
    expiresAt: Type.String({ format: "date-time" }),
  },
  { $id: "Selection", additionalProperties: false },
);
export type Selection = Static<typeof SelectionSchema>;

export const BulkTagActionTypeSchema = Type.Union(
  [Type.Literal("add_tags"), Type.Literal("remove_tags")],
  { $id: "BulkTagActionType" },
);
export type BulkTagActionType = Static<typeof BulkTagActionTypeSchema>;

export const BulkStateActionTypeSchema = Type.Union(
  [
    Type.Literal("favorite"),
    Type.Literal("unfavorite"),
    Type.Literal("mark_unread"),
    Type.Literal("mark_read"),
    Type.Literal("archive"),
    Type.Literal("restore"),
    Type.Literal("delete"),
  ],
  { $id: "BulkStateActionType" },
);
export type BulkStateActionType = Static<typeof BulkStateActionTypeSchema>;

export const BulkActionSchema = Type.Union(
  [
    Type.Object(
      {
        type: inline(BulkTagActionTypeSchema),
        tags: Type.Array(Type.String(), { minItems: 1, uniqueItems: true }),
      },
      { additionalProperties: false },
    ),
    Type.Object({ type: inline(BulkStateActionTypeSchema) }, { additionalProperties: false }),
  ],
  { $id: "BulkAction" },
);
export type BulkAction = Static<typeof BulkActionSchema>;

export const BulkResultSchema = Type.Object(
  {
    selectedCount: Type.Integer(),
    processedCount: Type.Integer(),
    changedCount: Type.Integer(),
  },
  { $id: "BulkResult", additionalProperties: false },
);
export type BulkResult = Static<typeof BulkResultSchema>;

export const SavedViewWriteSchema = Type.Object(
  {
    scope: inline(ScopeSchema),
    query: Type.String(),
    tags: Type.Array(Type.String(), { uniqueItems: true }),
    favorite: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    unread: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    sort: inline(SortOrderSchema),
    name: Type.String({ minLength: 1 }),
  },
  { $id: "SavedViewWrite", additionalProperties: false },
);
export type SavedViewWrite = Static<typeof SavedViewWriteSchema>;

export const SavedViewSchema = Type.Object(
  {
    scope: inline(ScopeSchema),
    query: Type.String(),
    tags: Type.Array(Type.String(), { uniqueItems: true }),
    favorite: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    unread: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    sort: inline(SortOrderSchema),
    name: Type.String({ minLength: 1 }),
    id: Type.Integer(),
    grammarVersion: Type.Literal(1),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
  },
  { $id: "SavedView", additionalProperties: false },
);
export type SavedView = Static<typeof SavedViewSchema>;

export const SavedViewListSchema = Type.Array(inline(SavedViewSchema), {
  $id: "SavedViewList",
});
export type SavedViewList = Static<typeof SavedViewListSchema>;

/** Schemas that can be registered with the server's JSON-schema registry. */
export const apiSchemas = [
  ScopeSchema,
  SortOrderSchema,
  MetadataStatusSchema,
  ProvenanceSchema,
  BookmarkIdParamsSchema,
  SavedViewIdParamsSchema,
  SelectionIdParamsSchema,
  HealthResponseSchema,
  TagSchema,
  TagSummarySchema,
  TagSummaryListSchema,
  BookmarkSchema,
  BookmarkCreateSchema,
  BookmarkPatchSchema,
  MetadataPreviewRequestSchema,
  MetadataPreviewSchema,
  BookmarkPageSchema,
  BookmarkListQuerySchema,
  MetadataRefreshResponseSchema,
  BookmarkIconResponseSchema,
  BookmarkIconHeadersSchema,
  SearchCriteriaSchema,
  SelectionCreateSchema,
  SelectionSchema,
  BulkTagActionTypeSchema,
  BulkStateActionTypeSchema,
  BulkActionSchema,
  BulkResultSchema,
  SavedViewWriteSchema,
  SavedViewSchema,
  SavedViewListSchema,
] as const;
