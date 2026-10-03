import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/app.js';

describe('library performance target', () => {
  let testApp: TestApp;
  beforeEach(async () => {
    testApp = await createTestApp();
    const db=testApp.storage.database.raw;
    const insert=db.prepare(`INSERT INTO bookmarks(id,url,normalized_url,title,description,notes,read_later,is_read,created_at,updated_at) VALUES(?,?,?,?,?,?,?,0,?,?)`);
    db.exec('BEGIN');
    for(let index=0;index<1000;index+=1){
      const id=`00000000-0000-4000-8000-${String(index).padStart(12,'0')}`;
      insert.run(id,`https://example.com/${index}`,`https://example.com/${index}`,`Bookmark ${index}`,index%10===0?'Ancient Rome article':'Other topic','notes',index%3===0?1:0,'2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z');
    }
    db.exec('COMMIT');
  });
  afterEach(async()=>testApp.close());
  it('searches and opens the unread queue within one second',async()=>{
    const started=performance.now();
    const search=await testApp.app.inject({method:'GET',url:'/api/bookmarks?q=%22ancient%20Rome%22&sort=title&order=asc'});
    const queue=await testApp.app.inject({method:'GET',url:'/api/bookmarks?scope=unread-read-later'});
    expect(search.statusCode).toBe(200); expect(search.json().data.items).toHaveLength(100);
    expect(queue.statusCode).toBe(200); expect(queue.json().data.items.length).toBeGreaterThan(300);
    expect(performance.now()-started).toBeLessThan(1000);
  });
});
