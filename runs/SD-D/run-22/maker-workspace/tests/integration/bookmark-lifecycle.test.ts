import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/app.js';

describe('bookmark lifecycle and read later', () => {
  let testApp: TestApp;
  beforeEach(async () => { testApp = await createTestApp(); });
  afterEach(async () => testApp.close());

  async function create(url='https://example.com/path') {
    return testApp.app.inject({method:'POST',url:'/api/bookmarks',payload:{url,title:'Example',description:'Description',notes:'Notes',tags:['Article'],readLater:true}});
  }

  it('creates, persists, and rejects a normalized duplicate', async () => {
    const response=await create();
    expect(response.statusCode).toBe(201);
    const item=response.json().data;
    expect(item).toMatchObject({title:'Example',tags:['Article'],readLater:true,isRead:false});
    const list=await testApp.app.inject({method:'GET',url:'/api/bookmarks'});
    expect(list.json().data.items).toHaveLength(1);
    const duplicate=await create('https://EXAMPLE.com:443/path#fragment');
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error).toMatchObject({code:'DUPLICATE_BOOKMARK',existingId:item.id});
  });

  it('moves through read-later states without deleting the bookmark', async () => {
    const id=(await create()).json().data.id;
    const markRead=await testApp.app.inject({method:'PATCH',url:`/api/bookmarks/${id}/reading-status`,payload:{readLater:true,isRead:true}});
    expect(markRead.json().data).toMatchObject({readLater:true,isRead:true});
    expect((await testApp.app.inject({method:'GET',url:'/api/bookmarks?scope=unread-read-later'})).json().data.items).toEqual([]);
    const unread=await testApp.app.inject({method:'PATCH',url:`/api/bookmarks/${id}/reading-status`,payload:{readLater:true,isRead:false}});
    expect(unread.json().data.isRead).toBe(false);
    expect((await testApp.app.inject({method:'GET',url:'/api/bookmarks?scope=unread-read-later'})).json().data.items).toHaveLength(1);
    const ordinary=await testApp.app.inject({method:'PATCH',url:`/api/bookmarks/${id}/reading-status`,payload:{readLater:false,isRead:false}});
    expect(ordinary.json().data).toMatchObject({readLater:false,isRead:false});
  });

  it('edits fields and tags transactionally, confirms API deletion result', async () => {
    const id=(await create()).json().data.id;
    const updated=await testApp.app.inject({method:'PATCH',url:`/api/bookmarks/${id}`,payload:{title:'Revised',description:null,notes:'New notes',tags:['Book','Research']}});
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data).toMatchObject({title:'Revised',description:null,notes:'New notes',tags:['Book','Research']});
    expect((await testApp.app.inject({method:'DELETE',url:`/api/bookmarks/${id}`})).statusCode).toBe(204);
    expect((await testApp.app.inject({method:'GET',url:'/api/bookmarks'})).json().data.items).toEqual([]);
    expect((await testApp.app.inject({method:'GET',url:'/api/tags'})).json().data).toEqual([]);
  });
});
