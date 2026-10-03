import { Type } from '@sinclair/typebox';

export const ErrorSchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
}, { additionalProperties: true });

export const HealthSchema = Type.Object({ status: Type.Literal('ok') }, { additionalProperties: false });

export const UuidParamsSchema = Type.Object({ bookmarkId: Type.String({ format: 'uuid' }) });

export const CollectionViewSchema = Type.Union([Type.Literal('active'),Type.Literal('to-read'),Type.Literal('archive')]);
export const SortFieldSchema = Type.Union([Type.Literal('title'),Type.Literal('createdAt'),Type.Literal('updatedAt')]);
export const SortDirectionSchema = Type.Union([Type.Literal('asc'),Type.Literal('desc')]);
export const TagSchema = Type.Object({id:Type.Integer(),name:Type.String({minLength:1,maxLength:50})},{additionalProperties:false});
export const RichTextMarkSchema = Type.Object({type:Type.Union([Type.Literal('bold'),Type.Literal('italic'),Type.Literal('link')]),attrs:Type.Optional(Type.Object({href:Type.Optional(Type.String())},{additionalProperties:false}))},{additionalProperties:false});
export const RichTextNodeSchema = Type.Recursive(Node=>Type.Object({type:Type.Union(['doc','paragraph','heading','text','bulletList','orderedList','listItem','blockquote','hardBreak'].map(value=>Type.Literal(value))),text:Type.Optional(Type.String()),attrs:Type.Optional(Type.Object({level:Type.Optional(Type.Union([Type.Literal(2),Type.Literal(3)]))},{additionalProperties:false})),marks:Type.Optional(Type.Array(RichTextMarkSchema)),content:Type.Optional(Type.Array(Node))},{additionalProperties:false}));
export const BookmarkSummarySchema = Type.Object({id:Type.String({format:'uuid'}),url:Type.String(),title:Type.String(),description:Type.Union([Type.String(),Type.Null()]),iconAssetUrl:Type.Union([Type.String(),Type.Null()]),previewAssetUrl:Type.Union([Type.String(),Type.Null()]),tags:Type.Array(TagSchema),favorite:Type.Boolean(),toRead:Type.Boolean(),archivedAt:Type.Union([Type.String(),Type.Null()]),createdAt:Type.String(),updatedAt:Type.String()},{additionalProperties:false});
export const BookmarkCreateSchema = Type.Object({url:Type.String({minLength:1,maxLength:4096}),title:Type.String({minLength:1,maxLength:300}),description:Type.Optional(Type.Union([Type.String({maxLength:2000}),Type.Null()])),notes:RichTextNodeSchema,tags:Type.Array(Type.String({minLength:1,maxLength:50}),{maxItems:20}),favorite:Type.Boolean(),toRead:Type.Boolean(),metadataDraftId:Type.Optional(Type.Union([Type.String({format:'uuid'}),Type.Null()]))},{additionalProperties:false});
export const PreferencesSchema = Type.Object({sortField:SortFieldSchema,sortDirection:SortDirectionSchema},{additionalProperties:false});
