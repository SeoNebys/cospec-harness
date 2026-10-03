import crypto from 'node:crypto';
import type { Db } from '../client.js';
import { normalizeName } from '../../../shared/normalization.js';
import { revision } from './bookmarks.js';

type Kind = 'tags' | 'collections';
type Row = Record<string, any>;

function table(kind: Kind): Kind { return kind; }

export function listLabels(db: Db, userId: number, kind: Kind, suggest = '') {
  const key = normalizeName(suggest).key;
  const join = kind === 'tags' ? 'LEFT JOIN bookmark_tags x ON x.tag_id=l.id' : 'LEFT JOIN bookmarks x ON x.collection_id=l.id';
  const countField = kind === 'tags' ? 'x.bookmark_id' : 'x.id';
  const rows = db.prepare(`SELECT l.public_id id,l.name,l.name_key,count(${countField}) bookmarkCount FROM ${table(kind)} l ${join} WHERE l.user_id=? GROUP BY l.id`).all(userId) as Row[];
  const filtered = key ? rows.filter((row) => row.name_key.includes(key)).sort((a,b) => Number(!a.name_key.startsWith(key))-Number(!b.name_key.startsWith(key)) || a.name_key.localeCompare(b.name_key)).slice(0,20) : rows.sort((a,b)=>a.name_key.localeCompare(b.name_key));
  return filtered.map(({ id, name, bookmarkCount }) => ({ id, name, bookmarkCount: Number(bookmarkCount) }));
}

export function createLabel(db: Db, userId: number, kind: Kind, name: string) {
  const normalized = normalizeName(name);
  if ([...normalized.display].length < 1 || [...normalized.display].length > 50) throw new Error('Name must be between 1 and 50 characters.');
  const now = new Date().toISOString(); const publicId = crypto.randomUUID();
  db.transaction(() => { db.prepare(`INSERT INTO ${table(kind)}(public_id,user_id,name,name_key,created_at,updated_at) VALUES(?,?,?,?,?,?)`).run(publicId,userId,normalized.display,normalized.key,now,now); revision(db,userId); })();
  return listLabels(db,userId,kind).find((item)=>item.id===publicId)!;
}

export function renameLabel(db: Db, userId: number, kind: Kind, publicId: string, name: string) {
  const normalized = normalizeName(name);
  if ([...normalized.display].length < 1 || [...normalized.display].length > 50) throw new Error('Name must be between 1 and 50 characters.');
  const result = db.transaction(() => { const changed=db.prepare(`UPDATE ${table(kind)} SET name=?,name_key=?,updated_at=? WHERE user_id=? AND public_id=?`).run(normalized.display,normalized.key,new Date().toISOString(),userId,publicId); if(changed.changes) revision(db,userId); return changed.changes; })();
  return result ? listLabels(db,userId,kind).find((item)=>item.id===publicId)! : null;
}

export function deleteLabel(db: Db,userId:number,kind:Kind,publicId:string,expectedCount:number): boolean {
  return db.transaction(()=>{
    const row=db.prepare(`SELECT id FROM ${table(kind)} WHERE user_id=? AND public_id=?`).get(userId,publicId) as Row|undefined; if(!row)return false;
    const count=kind==='tags' ? (db.prepare('SELECT count(*) count FROM bookmark_tags WHERE tag_id=?').get(row.id) as Row).count : (db.prepare('SELECT count(*) count FROM bookmarks WHERE collection_id=?').get(row.id) as Row).count;
    if(Number(count)!==expectedCount){const error:any=new Error('The affected bookmark count changed.');error.code='STALE_COUNT';throw error;}
    db.prepare(`DELETE FROM ${table(kind)} WHERE id=?`).run(row.id); revision(db,userId); return true;
  })();
}
