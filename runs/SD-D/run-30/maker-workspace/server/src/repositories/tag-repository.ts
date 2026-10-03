import type { Db } from '../db/connection.js';
export class TagRepository{constructor(private db:Db){} list(){return this.db.prepare('SELECT id,name FROM tags ORDER BY name COLLATE NOCASE').all()}}
