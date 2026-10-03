import { buildApp } from '../../src/server/app.js';
import { createTestDatabase } from './database.js';
export async function createTestApp(){const db=createTestDatabase();const app=await buildApp({db},false);await app.ready();return{app,db,close:async()=>{await app.close();db.close();}};}
