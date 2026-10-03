import fs from 'node:fs';
import path from 'node:path';
import type { DB } from './database.js';
export function migrate(db:DB){db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL)');const root=path.join(process.cwd(),'migrations');for(const name of fs.readdirSync(root).filter(f=>f.endsWith('.sql')).sort()){if(db.prepare('SELECT 1 FROM schema_migrations WHERE name=?').get(name))continue;const sql=fs.readFileSync(path.join(root,name),'utf8');db.transaction(()=>{db.exec(sql);db.prepare('INSERT INTO schema_migrations VALUES(?,?)').run(name,new Date().toISOString())})()}}
