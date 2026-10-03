import { randomUUID } from 'node:crypto';
import type { Database } from '../db/database.js';

export const tagKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
export class TagRepository {
  constructor(private db: Database) {}
  ensure(userId: string, raw: string): {id:string;name:string} {
    const name = raw.trim().replace(/\s+/g, ' '); const key = tagKey(name);
    if (!name || Array.from(name).length > 60) throw new Error('Tags must be 1–60 characters.');
    const existing = this.db.prepare('SELECT id,name FROM tags WHERE user_id=? AND name_key=?').get(userId,key) as {id:string;name:string}|undefined;
    if (existing) return existing;
    const result = { id: randomUUID(), name }; this.db.prepare('INSERT INTO tags(id,user_id,name,name_key) VALUES (?,?,?,?)').run(result.id,userId,name,key); return result;
  }
  suggestions(userId: string, search = '', limit = 10) {
    const query = tagKey(search); const bounded = Math.max(1, Math.min(limit,20));
    return this.db.prepare(`SELECT id,name FROM tags WHERE user_id=? AND name_key LIKE ? ORDER BY CASE WHEN name_key LIKE ? THEN 0 ELSE 1 END, name_key LIMIT ?`).all(userId,`%${query}%`,`${query}%`,bounded) as Array<{id:string;name:string}>;
  }
  cleanOrphans(userId: string) { this.db.prepare('DELETE FROM tags WHERE user_id=? AND NOT EXISTS (SELECT 1 FROM bookmark_tags WHERE tag_id=tags.id)').run(userId); }
}
