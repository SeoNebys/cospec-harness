import { createHash, randomUUID } from 'node:crypto';
import type { AppDatabase } from '../db/database.js';
import { detectImageType } from './extractor.js';

type PendingIcon = { bytes: Buffer; contentType: string; expires: number };
export class IconStore {
  private pending = new Map<string,PendingIcon>();
  constructor(private db: AppDatabase) {}
  stage(bytes: Buffer): string|null {
    if (bytes.length > 262_144) return null;
    const contentType = detectImageType(bytes); if (!contentType) return null;
    const token = randomUUID(); this.pending.set(token, { bytes, contentType, expires: Date.now() + 10 * 60_000 }); return token;
  }
  consume(token?: string|null): number|null {
    if (!token) return null;
    const icon = this.pending.get(token); this.pending.delete(token);
    if (!icon || icon.expires < Date.now()) return null;
    const hash = createHash('sha256').update(icon.bytes).digest('hex');
    this.db.prepare('INSERT OR IGNORE INTO icon_assets (content_type,bytes,content_hash,created_at) VALUES (?,?,?,?)').run(icon.contentType, icon.bytes, hash, new Date().toISOString());
    return (this.db.prepare('SELECT id FROM icon_assets WHERE content_hash=?').get(hash) as {id:number}).id;
  }
  get(id:number): {bytes:Buffer;contentType:string}|null {
    const row = this.db.prepare('SELECT bytes, content_type contentType FROM icon_assets WHERE id=?').get(id) as {bytes:Buffer;contentType:string}|undefined;
    return row ?? null;
  }
}
