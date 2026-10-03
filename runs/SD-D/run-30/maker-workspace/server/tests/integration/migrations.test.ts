import { describe,expect,it } from 'vitest';import { testDatabase } from '../helpers/database.js';
describe('migrations',()=>{it('applies once with foreign keys enabled',()=>{const db=testDatabase();expect(db.pragma('foreign_keys',{simple:true})).toBe(1);expect((db.prepare('select count(*) count from schema_migrations').get() as {count:number}).count).toBe(1);db.close()})});
