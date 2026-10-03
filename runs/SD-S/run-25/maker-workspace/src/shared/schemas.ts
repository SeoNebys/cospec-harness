import { z } from "zod";

import {
  BOOKMARK_LIST_VIEWS,
  READING_STATES,
  SORT_ORDERS,
  type BookmarkInput,
  type PageMetadataRequest,
  type ReadingStateUpdate,
  type ResolvedBookmarkListQuery,
} from "./contracts.js";

const codePointLength = (value: string): number => [...value].length;

const hasAtMostCodePoints = (maximum: number) => (value: string): boolean =>
  codePointLength(value) <= maximum;

const canonicalUrlOrNull = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

/** A bookmark URL after surrounding whitespace is removed. */
export const bookmarkUrlSchema = z
  .string({ error: "URL must be text." })
  .trim()
  .min(1, "Enter a URL.")
  .refine(hasAtMostCodePoints(4_096), "URL must be 4,096 characters or fewer.")
  .superRefine((value, context) => {
    const parsed = canonicalUrlOrNull(value);

    if (parsed === null || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
      context.addIssue({
        code: "custom",
        message: "Enter an absolute HTTP or HTTPS URL.",
      });
      return;
    }

    if (parsed.username !== "" || parsed.password !== "") {
      context.addIssue({
        code: "custom",
        message: "URLs containing a username or password are not supported.",
      });
    }

    if (codePointLength(parsed.toString()) > 4_096) {
      context.addIssue({
        code: "custom",
        message: "The canonical URL must be 4,096 characters or fewer.",
      });
    }
  });

export const bookmarkTitleSchema = z
  .string({ error: "Title must be text." })
  .trim()
  .min(1, "Enter a title.")
  .refine(hasAtMostCodePoints(300), "Title must be 300 characters or fewer.");

export const bookmarkDescriptionSchema = z
  .string({ error: "Description must be text." })
  .trim()
  .refine(
    hasAtMostCodePoints(2_000),
    "Description must be 2,000 characters or fewer.",
  );

export const tagNameSchema = z
  .string({ error: "Tag must be text." })
  .trim()
  .min(1, "Tags cannot be empty.")
  .refine(hasAtMostCodePoints(40), "Tags must be 40 characters or fewer.")
  .refine(
    (value) => hasAtMostCodePoints(40)(value.normalize("NFKC").toLowerCase()),
    "A normalized tag must be 40 characters or fewer.",
  );

export const bookmarkTagsSchema = z
  .array(tagNameSchema, { error: "Tags must be a list." })
  .max(20, "A bookmark can have at most 20 tags.");

export const readingStateSchema = z.enum(READING_STATES, {
  error: "Reading state must be untracked, to_read, or read.",
});

export const sortOrderSchema = z.enum(SORT_ORDERS, {
  error: "Sort must be newest, oldest, or title.",
});

export const bookmarkListViewSchema = z.enum(BOOKMARK_LIST_VIEWS, {
  error: "View must be all or read-later.",
});

export const bookmarkInputSchema = z
  .object({
    url: bookmarkUrlSchema,
    title: bookmarkTitleSchema,
    description: bookmarkDescriptionSchema.default(""),
    tags: bookmarkTagsSchema.default([]),
    readingState: readingStateSchema.default("untracked"),
    allowDuplicate: z.boolean({ error: "Duplicate confirmation must be true or false." }).default(false),
  })
  .strict() satisfies z.ZodType<BookmarkInput, unknown>;

const queryTagSchema = z.preprocess(
  (value) => {
    if (value === undefined) return [];
    return Array.isArray(value) ? value : [value];
  },
  bookmarkTagsSchema,
);

export const bookmarkListQuerySchema = z
  .object({
    view: bookmarkListViewSchema.default("all"),
    query: z
      .string({ error: "Search query must be text." })
      .trim()
      .max(300, "Search query must be 300 characters or fewer.")
      .default(""),
    tag: queryTagSchema,
    sort: sortOrderSchema.default("newest"),
  })
  .strict() satisfies z.ZodType<ResolvedBookmarkListQuery>;

export const readingStateUpdateSchema = z
  .object({ readingState: readingStateSchema })
  .strict() satisfies z.ZodType<ReadingStateUpdate>;

export const pageMetadataRequestSchema = z
  .object({ url: bookmarkUrlSchema })
  .strict() satisfies z.ZodType<PageMetadataRequest>;

export const bookmarkIdSchema = z.uuid({ error: "Bookmark ID must be a UUID." });

export type ValidatedBookmarkInput = z.output<typeof bookmarkInputSchema>;
export type ValidatedBookmarkListQuery = z.output<typeof bookmarkListQuerySchema>;
