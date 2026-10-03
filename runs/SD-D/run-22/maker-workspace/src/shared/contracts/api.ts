import { z } from 'zod';

export const limits = {
  url: 4096,
  title: 300,
  description: 2000,
  notes: 10_000,
  tag: 100,
  query: 1000,
} as const;

const nullableLimitedText = (max: number) => z.string().max(max).nullable();
export const HttpUrlSchema = z
  .string()
  .max(limits.url)
  .url()
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an HTTP or HTTPS URL');
export const TagNameSchema = z.string().trim().min(1).max(limits.tag);

export const BookmarkSchema = z
  .object({
    id: z.uuid(),
    url: HttpUrlSchema,
    title: z.string().trim().min(1).max(limits.title),
    description: nullableLimitedText(limits.description),
    iconUrl: z.string().nullable(),
    notes: nullableLimitedText(limits.notes),
    tags: z.array(TagNameSchema),
    readLater: z.boolean(),
    isRead: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine(({ readLater, isRead }) => readLater || !isRead, {
    message: 'A bookmark outside read later cannot be read',
    path: ['isRead'],
  });

export const BookmarkInputSchema = z.object({
  url: HttpUrlSchema,
  title: z.string().trim().min(1).max(limits.title),
  description: nullableLimitedText(limits.description).optional().default(null),
  iconToken: z.string().nullable().optional().default(null),
  notes: nullableLimitedText(limits.notes).optional().default(null),
  tags: z.array(TagNameSchema).default([]),
  readLater: z.boolean().default(false),
});

export const BookmarkPatchSchema = BookmarkInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Supply at least one field',
);

export const ReadingStateInputSchema = z
  .object({ readLater: z.boolean(), isRead: z.boolean() })
  .refine(({ readLater, isRead }) => readLater || !isRead, {
    message: 'isRead must be false when readLater is false',
    path: ['isRead'],
  });

export const MetadataFieldStatusSchema = z.enum(['found', 'missing', 'invalid', 'fetch_failed']);
export const MetadataFieldSchema = z.object({
  status: MetadataFieldStatusSchema,
  value: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});
export const MetadataPreviewSchema = z.object({
  requestedUrl: HttpUrlSchema,
  finalUrl: HttpUrlSchema.nullable(),
  outcome: z.enum(['complete', 'partial', 'failed']),
  fields: z.object({
    title: MetadataFieldSchema,
    description: MetadataFieldSchema,
    icon: MetadataFieldSchema,
  }),
  iconToken: z.string().nullable().optional(),
  warnings: z.array(z.string()),
});

export const QuerySummarySchema = z.object({
  raw: z.string().max(limits.query),
  ast: z.record(z.string(), z.unknown()),
  labels: z.array(z.string()),
});
export const TagSummarySchema = z.object({ name: TagNameSchema, bookmarkCount: z.number().int().nonnegative() });

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  existingId: z.uuid().optional(),
  span: z.object({ start: z.number().int().nonnegative(), end: z.number().int().nonnegative() }).optional(),
});
export const ErrorEnvelopeSchema = z.object({ error: ApiErrorSchema });
export const successEnvelope = <T extends z.ZodType>(schema: T) => z.object({ data: schema });
export const BookmarkEnvelopeSchema = successEnvelope(BookmarkSchema);
export const MetadataPreviewEnvelopeSchema = successEnvelope(MetadataPreviewSchema);

export type Bookmark = z.infer<typeof BookmarkSchema>;
export type BookmarkInput = z.infer<typeof BookmarkInputSchema>;
export type BookmarkPatch = z.infer<typeof BookmarkPatchSchema>;
export type ReadingStateInput = z.infer<typeof ReadingStateInputSchema>;
export type MetadataPreview = z.infer<typeof MetadataPreviewSchema>;
export type QuerySummary = z.infer<typeof QuerySummarySchema>;
export type TagSummary = z.infer<typeof TagSummarySchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
export type SuccessEnvelope<T> = { data: T };
