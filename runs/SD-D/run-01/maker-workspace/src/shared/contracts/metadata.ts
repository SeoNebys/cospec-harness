import { Type } from 'typebox';

export const MetadataPreviewRequest = Type.Object({ url: Type.String({ maxLength: 4096 }) });
export const MetadataPreview = Type.Object({
  url: Type.String(), canonicalKey: Type.String(),
  status: Type.Union([Type.Literal('retrieved'), Type.Literal('partial'), Type.Literal('fallback')]),
  title: Type.String({ minLength: 1, maxLength: 300 }), description: Type.String({ maxLength: 1000 }),
  iconAvailable: Type.Boolean(), previewToken: Type.Optional(Type.String()), warnings: Type.Array(Type.String()),
});
