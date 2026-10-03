import { buildApp } from '../../src/server/app.js';
import { testDatabase } from './database.js';
export async function testServer(){const db=testDatabase();const app=await buildApp({db});return {app,db,close:async()=>{await app.close();db.close();}};}
