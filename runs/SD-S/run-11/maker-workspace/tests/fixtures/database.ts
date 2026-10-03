import {openDatabase} from '../../src/server/db/database.ts';import {migrate} from '../../src/server/db/migrate.ts';export function testDb(){const db=openDatabase(':memory:');migrate(db);return db;}
