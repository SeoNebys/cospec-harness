import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/server/app.js";
import { createDatabase } from "../../src/server/db/client.js";
import { loadConfig } from "../../src/server/config.js";
import { MemoryMailer } from "../../src/server/mail/mailer.js";

export const origin="http://127.0.0.1:4000";
export async function testApp(){const db=createDatabase(":memory:");const config=loadConfig({NODE_ENV:"test",DATABASE_PATH:":memory:",APP_ORIGIN:origin,AUTH_BASE_URL:origin,AUTH_SECRET:"test-secret-that-is-at-least-thirty-two-characters",MAIL_TRANSPORT:"memory"});const mailer=new MemoryMailer();const app=await buildApp({db,config,mailer,logger:false});return{app,db,mailer};}
export async function registerAndSignIn(app:FastifyInstance,email="user@example.com"){const password="this-is-a-long-password";await app.inject({method:"POST",url:"/api/auth/sign-up/email",headers:{origin,"content-type":"application/json"},payload:{name:"User",email,password}});const response=await app.inject({method:"POST",url:"/api/auth/sign-in/email",headers:{origin,"content-type":"application/json"},payload:{email,password}});const raw=Array.isArray(response.headers["set-cookie"])?response.headers["set-cookie"][0]:response.headers["set-cookie"];return String(raw).split(";",1)[0]!;}
export const mutationHeaders=(cookie:string)=>({origin,cookie,"content-type":"application/json","x-bookmark-app":"1"});
