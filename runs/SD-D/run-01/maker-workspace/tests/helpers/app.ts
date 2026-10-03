import { buildApp } from '../../src/server/app.js';
import { migrate, openDatabase } from '../../src/server/db/database.js';
import { readEnv } from '../../src/server/config/env.js';
export async function testApp(){const db=openDatabase(':memory:');migrate(db,process.cwd());const app=await buildApp(db,readEnv({DATABASE_PATH:':memory:',COOKIE_SECURE:'false'}));return{app,db,close:async()=>{await app.close();db.close();}}}
export async function register(app:any,email='person@example.com'){const response=await app.inject({method:'POST',url:'/api/v1/auth/register',payload:{email,password:'a very secure password'}});return{response,cookie:String(response.headers['set-cookie']).split(';')[0]};}
