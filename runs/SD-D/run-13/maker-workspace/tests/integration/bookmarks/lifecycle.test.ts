import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { buildApp } from '../../../src/server/app.js';
import { createTestDatabase } from '../../fixtures/database.js';
import type { FastifyInstance } from 'fastify';
import type { BookmarkDatabase } from '../../../src/server/db/connection.js';
const input={url:'https://Example.com:443/article?b=2&a=1#part',title:'A useful guide',description:'Description',notes:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Exact note phrase'}]}]},tags:['Research','Work notes'],favorite:true,toRead:true};
describe('bookmark lifecycle API',()=>{let app:FastifyInstance;let db:BookmarkDatabase;beforeEach(async()=>{db=createTestDatabase();app=await buildApp({db},false);await app.ready();});afterEach(async()=>{await app.close();db.close();});
  it('creates, searches, updates, archives, restores, and deletes durably',async()=>{
    const created=await app.inject({method:'POST',url:'/api/bookmarks',payload:input});expect(created.statusCode).toBe(201);const bookmark=created.json();
    const found=await app.inject({method:'GET',url:'/api/bookmarks?view=to-read&q=%22Exact%20note%22%20AND%20tag%3Aresearch'});expect(found.json().total).toBe(1);
    const patched=await app.inject({method:'PATCH',url:`/api/bookmarks/${bookmark.id}`,payload:{toRead:false}});expect(patched.json().toRead).toBe(false);
    expect((await app.inject({method:'POST',url:`/api/bookmarks/${bookmark.id}/archive`})).json().archivedAt).not.toBeNull();
    expect((await app.inject({method:'GET',url:'/api/bookmarks?view=active'})).json().total).toBe(0);expect((await app.inject({method:'GET',url:'/api/bookmarks?view=archive'})).json().total).toBe(1);
    expect((await app.inject({method:'POST',url:`/api/bookmarks/${bookmark.id}/restore`})).json().archivedAt).toBeNull();
    expect((await app.inject({method:'DELETE',url:`/api/bookmarks/${bookmark.id}`})).statusCode).toBe(204);expect((await app.inject({method:'GET',url:`/api/bookmarks/${bookmark.id}`})).statusCode).toBe(404);
  });
  it('returns the existing active or archived target for equivalent duplicates',async()=>{const first=(await app.inject({method:'POST',url:'/api/bookmarks',payload:input})).json();let duplicate=await app.inject({method:'POST',url:'/api/bookmarks',payload:{...input,url:'https://example.com/article?b=2&a=1#part'}});expect(duplicate.statusCode).toBe(409);expect(duplicate.json().bookmark).toMatchObject({id:first.id,archived:false});await app.inject({method:'POST',url:`/api/bookmarks/${first.id}/archive`});duplicate=await app.inject({method:'POST',url:'/api/bookmarks',payload:{...input,url:'https://example.com/article?b=2&a=1#part'}});expect(duplicate.json().bookmark.archived).toBe(true);expect((await app.inject({method:'GET',url:'/api/bookmarks?view=archive'})).json().total).toBe(1);});
  it('rejects invalid search without losing its offset',async()=>{const response=await app.inject({method:'GET',url:'/api/bookmarks?q=%22unfinished'});expect(response.statusCode).toBe(422);expect(response.json()).toMatchObject({code:'SEARCH_SYNTAX_ERROR',start:0});});
});
