import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from '../db/client.js';
import { config } from '../config.js';
import { safeFetch } from './safe-fetch.js';

const allowed = /^image\/(png|jpeg|webp|gif)$/i;

export async function getMedia(db: Db, sourceUrl: string, kind: 'icon' | 'preview') {
  const key = crypto.createHash('sha256').update(`${kind}:${sourceUrl}`).digest('hex');
  const row = db.prepare('SELECT * FROM media_cache WHERE cache_key=?').get(key) as any;
  if (row) {
    const full = path.resolve(config.mediaCachePath, row.relative_path);
    if (full.startsWith(`${config.mediaCachePath}${path.sep}`) && fs.existsSync(full)) {
      db.prepare('UPDATE media_cache SET last_accessed_at=? WHERE cache_key=?').run(new Date().toISOString(), key);
      return { mediaType: row.media_type, bytes: fs.readFileSync(full) };
    }
  }
  const maxBytes = kind === 'icon' ? config.metadata.maxIconBytes : config.metadata.maxPreviewBytes;
  const fetched = await safeFetch(sourceUrl, { maxBytes, accept: 'image/png,image/jpeg,image/webp,image/gif', allowedTypes: allowed });
  if (!allowed.test(fetched.contentType)) throw new Error('Unsupported image type.');
  fs.mkdirSync(config.mediaCachePath, { recursive: true });
  const relative = `${key}.bin`; const full = path.resolve(config.mediaCachePath, relative);
  fs.writeFileSync(full, fetched.body, { mode: 0o600 });
  const now = new Date().toISOString(); const expires = new Date(Date.now()+7*86400000).toISOString();
  db.prepare(`INSERT INTO media_cache(cache_key,source_url,kind,relative_path,media_type,byte_size,fetched_at,last_accessed_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET relative_path=excluded.relative_path,media_type=excluded.media_type,byte_size=excluded.byte_size,last_accessed_at=excluded.last_accessed_at,expires_at=excluded.expires_at`)
    .run(key,sourceUrl,kind,relative,fetched.contentType,fetched.body.length,now,now,expires);
  return { mediaType: fetched.contentType, bytes: fetched.body };
}

export function evictMediaCache(db: Db, maxBytes=100*1024*1024): void {
  const rows=db.prepare('SELECT * FROM media_cache ORDER BY last_accessed_at DESC').all() as any[];let total=0;
  for(const row of rows){total+=row.byte_size;if(total<=maxBytes)continue;const full=path.resolve(config.mediaCachePath,row.relative_path);if(full.startsWith(`${config.mediaCachePath}${path.sep}`))fs.rmSync(full,{force:true});db.prepare('DELETE FROM media_cache WHERE cache_key=?').run(row.cache_key);}
}
