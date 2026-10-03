import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';

export type Db = Database.Database;
const localMigrations=path.join(path.dirname(fileURLToPath(import.meta.url)),'migrations');
const migrationsDir=fs.existsSync(localMigrations)?localMigrations:path.resolve('server/src/db/migrations');
export function openDatabase(filename:string):Db {
  if(filename!==':memory:') fs.mkdirSync(path.dirname(filename),{recursive:true});
  const db=new Database(filename); db.pragma('foreign_keys = ON'); db.pragma('journal_mode = WAL'); migrate(db); return db;
}
export function migrate(db:Db){
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  for(const file of fs.readdirSync(migrationsDir).filter(x=>x.endsWith('.sql')).sort()){
    if(!db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(file)) db.transaction(()=>{db.exec(fs.readFileSync(path.join(migrationsDir,file),'utf8'));db.prepare('INSERT INTO schema_migrations VALUES(?,?)').run(file,new Date().toISOString())})();
  }
}
