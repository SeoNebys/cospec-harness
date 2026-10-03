import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { createTestDatabase } from '../fixtures/database.js';
import type { FastifyInstance } from 'fastify';
import type { BookmarkDatabase } from '../../src/server/db/connection.js';
describe('core API contracts',()=>{let app:FastifyInstance;let db:BookmarkDatabase;beforeEach(async()=>{db=createTestDatabase();app=await buildApp({db},false);await app.ready();});afterEach(async()=>{await app.close();db.close();});it('reports readiness and defaults',async()=>{expect((await app.inject({url:'/api/health'})).json()).toEqual({status:'ok'});expect((await app.inject({url:'/api/preferences'})).json()).toEqual({sortField:'createdAt',sortDirection:'desc'});expect((await app.inject({url:'/api/bookmarks'})).json()).toMatchObject({items:[],total:0,page:1,pageSize:50});});it('protects same-origin mutations',async()=>{const response=await app.inject({method:'PATCH',url:'/api/preferences',headers:{origin:'https://evil.example',host:'keepsake.test'},payload:{sortField:'title'}});expect(response.statusCode).toBe(403);});});
