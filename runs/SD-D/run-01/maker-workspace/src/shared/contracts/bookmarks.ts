import { Type } from 'typebox';

export const ReadLaterState = Type.Union([Type.Literal('none'), Type.Literal('unread'), Type.Literal('read')]);
export const BookmarkInput = Type.Object({
  url: Type.String({ maxLength: 4096 }), title: Type.String({ minLength: 1, maxLength: 300 }),
  description: Type.Optional(Type.String({ maxLength: 1000 })), notes: Type.Optional(Type.String({ maxLength: 5000 })),
  tags: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 60 }), { maxItems: 50 })),
  isFavorite: Type.Optional(Type.Boolean()), readLaterState: Type.Optional(ReadLaterState), previewToken: Type.Optional(Type.String()),
});
export const BookmarkPatch = Type.Partial(BookmarkInput);
