import type { AppDatabase } from '../db/connection.js';

export interface MediaRow {
  id: number;
  public_id: string;
  media_type: string;
  relative_path: string;
  state: 'temporary' | 'claimed';
  expires_at: string | null;
}

export class MediaRepository {
  constructor(private db: AppDatabase) {}
  findByHash(hash: string, type: string): MediaRow | undefined {
    return this.db
      .prepare('SELECT * FROM media_assets WHERE content_hash = ? AND media_type = ?')
      .get(hash, type) as MediaRow | undefined;
  }
  findByPublicId(id: string): MediaRow | undefined {
    return this.db.prepare('SELECT * FROM media_assets WHERE public_id = ?').get(id) as MediaRow | undefined;
  }
  insert(values: {
    publicId: string;
    hash: string;
    type: string;
    bytes: number;
    path: string;
    expiresAt: string;
    createdAt: string;
  }): MediaRow {
    const result = this.db
      .prepare(
        `INSERT INTO media_assets(public_id,content_hash,media_type,byte_length,relative_path,state,expires_at,created_at) VALUES (@publicId,@hash,@type,@bytes,@path,'temporary',@expiresAt,@createdAt)`,
      )
      .run(values);
    return this.db.prepare('SELECT * FROM media_assets WHERE id = ?').get(result.lastInsertRowid) as MediaRow;
  }
  claim(ids: Array<number | null>): void {
    for (const id of ids)
      if (id) this.db.prepare("UPDATE media_assets SET state='claimed', expires_at=NULL WHERE id=?").run(id);
  }
}
