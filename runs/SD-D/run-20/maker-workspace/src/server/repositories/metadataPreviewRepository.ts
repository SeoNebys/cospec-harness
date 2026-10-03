import type { AppDatabase } from '../db/connection.js';

export interface PreviewRow {
  id: number;
  public_id: string;
  requested_url: string;
  normalized_url: string;
  final_response_url: string | null;
  title: string;
  description: string | null;
  icon_asset_id: number | null;
  preview_asset_id: number | null;
  icon_public_id?: string | null;
  preview_public_id?: string | null;
  status: 'complete' | 'partial' | 'failed' | 'skipped' | 'fallback';
  warnings_json: string;
  created_at: string;
  expires_at: string;
}

export class MetadataPreviewRepository {
  constructor(private db: AppDatabase) {}
  create(value: Omit<PreviewRow, 'id' | 'icon_public_id' | 'preview_public_id'>): PreviewRow {
    const result = this.db
      .prepare(
        `INSERT INTO metadata_previews(public_id,requested_url,normalized_url,final_response_url,title,description,icon_asset_id,preview_asset_id,status,warnings_json,created_at,expires_at)
      VALUES (@public_id,@requested_url,@normalized_url,@final_response_url,@title,@description,@icon_asset_id,@preview_asset_id,@status,@warnings_json,@created_at,@expires_at)`,
      )
      .run(value);
    return this.byInternalId(Number(result.lastInsertRowid))!;
  }
  byId(publicId: string): PreviewRow | undefined {
    return this.joined('p.public_id=?', publicId);
  }
  private byInternalId(id: number): PreviewRow | undefined {
    return this.joined('p.id=?', id);
  }
  private joined(where: string, value: string | number): PreviewRow | undefined {
    return this.db
      .prepare(
        `SELECT p.*,ia.public_id icon_public_id,pa.public_id preview_public_id FROM metadata_previews p LEFT JOIN media_assets ia ON ia.id=p.icon_asset_id LEFT JOIN media_assets pa ON pa.id=p.preview_asset_id WHERE ${where}`,
      )
      .get(value) as PreviewRow | undefined;
  }
}
