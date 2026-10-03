import { LIMITS } from '../../../shared/config/limits.js';
import { BaseRepository } from './base-repository.js';

export interface MetadataDraftInput {
  normalizedUrl: string; sourceUrl: string; finalUrl: string; title: string | null; description: string | null;
  iconAssetId: string | null; previewAssetId: string | null; warnings: string[];
}
export interface MetadataDraft extends MetadataDraftInput { id: string; createdAt: number; expiresAt: number }

export class MetadataDraftRepository extends BaseRepository {
  create(input: MetadataDraftInput): MetadataDraft {
    const createdAt = this.now();
    const draft = { ...input, id: this.uuid(), createdAt, expiresAt: createdAt + LIMITS.draftLifetimeMs };
    this.db.prepare(`INSERT INTO metadata_drafts(id,normalized_url,source_url,final_url,title,description,icon_asset_id,preview_asset_id,warnings_json,created_at,expires_at)
      VALUES(@id,@normalizedUrl,@sourceUrl,@finalUrl,@title,@description,@iconAssetId,@previewAssetId,@warningsJson,@createdAt,@expiresAt)`)
      .run({ ...draft, warningsJson: JSON.stringify(draft.warnings) });
    return draft;
  }

  get(id: string): MetadataDraft | null {
    const row = this.db.prepare('SELECT * FROM metadata_drafts WHERE id=? AND expires_at>?').get(id, this.now()) as any;
    return row ? { id: row.id, normalizedUrl: row.normalized_url, sourceUrl: row.source_url, finalUrl: row.final_url, title: row.title, description: row.description, iconAssetId: row.icon_asset_id, previewAssetId: row.preview_asset_id, warnings: JSON.parse(row.warnings_json), createdAt: row.created_at, expiresAt: row.expires_at } : null;
  }

  getAsset(draftId: string, kind: 'icon' | 'preview') {
    return this.db.prepare(`SELECT a.id,a.mime_type,a.bytes,a.byte_length,a.width,a.height FROM metadata_drafts d JOIN media_assets a ON a.id=${kind === 'icon' ? 'd.icon_asset_id' : 'd.preview_asset_id'} WHERE d.id=? AND d.expires_at>?`).get(draftId, this.now()) as any;
  }

  deleteExpired(): number { return this.db.prepare('DELETE FROM metadata_drafts WHERE expires_at<=?').run(this.now()).changes; }
}
