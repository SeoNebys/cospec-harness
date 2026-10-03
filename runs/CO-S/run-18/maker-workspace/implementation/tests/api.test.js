import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';

test('bookmark lifecycle follows approved behavior', async t => {
  const temp = await mkdtemp(join(tmpdir(),'keepmark-test-'));
  process.env.KEEPMARK_DATA_FILE = join(temp,'bookmarks.json');
  const metadataServer = http.createServer((req,res)=>{if(req.url==='/unavailable'){res.writeHead(503,{'content-type':'text/plain'});res.end('unavailable');return}res.writeHead(200,{'content-type':'text/html'});res.end('<title>Test Article</title><meta name="description" content="Collected automatically">')});
  await new Promise(resolve=>metadataServer.listen(0,'127.0.0.1',resolve));
  const metadataPort = metadataServer.address().port;
  const { createServer } = await import(`../server.js?test=${Date.now()}`);
  const server = createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const api=async(path,options={})=>{const response=await fetch(base+path,{headers:{'content-type':'application/json'},...options});return {status:response.status,data:await response.json()}};
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>metadataServer.close(resolve));await rm(temp,{recursive:true,force:true})});

  const invalid=await api('/api/bookmarks',{method:'POST',body:JSON.stringify({url:'not a link'})});
  assert.equal(invalid.status,422);

  const url=`http://127.0.0.1:${metadataPort}/article`;
  const created=await api('/api/bookmarks',{method:'POST',body:JSON.stringify({url,tags:['Research','research'],note:'Remember this',readLater:true})});
  assert.equal(created.status,201);assert.equal(created.data.bookmark.title,'Test Article');assert.deepEqual(created.data.bookmark.tags,['research']);assert.equal(created.data.bookmark.readLater,true);
  const id=created.data.bookmark.id;

  const duplicate=await api('/api/bookmarks',{method:'POST',body:JSON.stringify({url:url+'/#comments'})});
  assert.equal(duplicate.status,409);assert.equal(duplicate.data.bookmark.id,id);

  const search=await api('/api/bookmarks?section=active&search=remember');
  assert.equal(search.data.total,1);
  const byTag=await api('/api/bookmarks?section=active&tag=research');
  assert.equal(byTag.data.total,1);

  const fallback=await api('/api/bookmarks',{method:'POST',body:JSON.stringify({url:`http://127.0.0.1:${metadataPort}/unavailable`})});
  assert.equal(fallback.status,201);assert.equal(fallback.data.bookmark.metadataStatus,'unavailable');assert.match(fallback.data.bookmark.title,/unavailable/);
  const enriched=await api(`/api/bookmarks/${fallback.data.bookmark.id}`,{method:'PATCH',body:JSON.stringify({title:'Added later',description:'Filled in by the person'})});
  assert.equal(enriched.data.bookmark.title,'Added later');
  await api(`/api/bookmarks/${fallback.data.bookmark.id}`,{method:'DELETE'});

  await api(`/api/bookmarks/${id}/archive`,{method:'POST',body:'{}'});
  assert.equal((await api('/api/bookmarks?section=active')).data.total,0);
  assert.equal((await api('/api/bookmarks?section=read-later')).data.total,0);
  assert.equal((await api('/api/bookmarks?section=archive')).data.total,1);

  const restored=await api(`/api/bookmarks/${id}/restore`,{method:'POST',body:'{}'});
  assert.equal(restored.data.bookmark.readLater,false);
  const edited=await api(`/api/bookmarks/${id}`,{method:'PATCH',body:JSON.stringify({title:'Edited title',description:'Edited description',readLater:true})});
  assert.equal(edited.data.bookmark.title,'Edited title');assert.equal(edited.data.bookmark.readLater,true);
  await api(`/api/bookmarks/${id}/complete-read-later`,{method:'POST',body:'{}'});
  assert.equal((await api('/api/bookmarks?section=read-later')).data.total,0);

  const deleted=await api(`/api/bookmarks/${id}`,{method:'DELETE'});
  assert.equal(deleted.status,200);assert.equal((await api('/api/summary')).data.active,0);
  const persisted=JSON.parse(await readFile(process.env.KEEPMARK_DATA_FILE,'utf8'));
  assert.equal(persisted.bookmarks.length,0);
});
