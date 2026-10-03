import { Type } from 'typebox';
export const ImportPreview = Type.Object({id:Type.String(),format:Type.Union([Type.Literal('browser-html'),Type.Literal('complete-json')]),status:Type.String(),totalCount:Type.Number(),newCount:Type.Number(),duplicateCount:Type.Number(),invalidCount:Type.Number(),issues:Type.Array(Type.String()),expiresAt:Type.String()});
export const CompleteBackup = Type.Object({format:Type.Literal('bookmark-manager-backup'),schemaVersion:Type.Literal(1),exportedAt:Type.String(),bookmarks:Type.Array(Type.Unknown(),{maxItems:20000})});
