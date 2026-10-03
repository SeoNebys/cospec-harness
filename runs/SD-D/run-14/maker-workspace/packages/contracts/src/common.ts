import { Type, type Static } from '@sinclair/typebox';

export const ErrorEnvelopeSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    field: Type.Optional(Type.String()),
    position: Type.Optional(Type.Integer({ minimum: 0 })),
    length: Type.Optional(Type.Integer({ minimum: 0 }))
  })
});
export type ErrorEnvelope = Static<typeof ErrorEnvelopeSchema>;

export const SortFieldSchema = Type.Union([
  Type.Literal('createdAt'), Type.Literal('updatedAt'), Type.Literal('title'), Type.Literal('destination')
]);
export const SortDirectionSchema = Type.Union([Type.Literal('asc'), Type.Literal('desc')]);
export type SortField = Static<typeof SortFieldSchema>;
export type SortDirection = Static<typeof SortDirectionSchema>;
