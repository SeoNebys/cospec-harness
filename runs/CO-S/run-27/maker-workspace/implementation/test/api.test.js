import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

test('bookmark API supports the complete stored-bookmark lifecycle',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'keeplist-api-')); const data=path.join(directory,'bookmarks.json'); const port=43000+Math.floor(Math.random()*1000);
  const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,PORT:String(port),BOOKMARK_DATA_FILE:data},stdio:['ignore','pipe','pipe']});
  const base=`http://127.0.0.1:${port}`;
  try {
    await new Promise((resolve,reject)=>{ const timeout=setTimeout(()=>reject(new Error('server timeout')),5000); child.stdout.on('data',data=>{if(String(data).includes('listening')){clearTimeout(timeout);resolve();}}); child.on('exit',code=>reject(new Error(`server exited ${code}`))); });
    const create=await fetch(`${base}/api/bookmarks`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://example.com/article',title:'Useful article',description:'About testing',tags:['Reference']})}); assert.equal(create.status,201); const item=await create.json();
    const duplicate=await fetch(`${base}/api/bookmarks`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:item.url,title:'Copy'})}); assert.equal(duplicate.status,409);
    const search=await (await fetch(`${base}/api/bookmarks?query=testing`)).json(); assert.equal(search.length,1);
    const marked=await (await fetch(`${base}/api/bookmarks/${item.id}/read-later`,{method:'PATCH'})).json(); assert.equal(marked.readLater,true);
    const later=await (await fetch(`${base}/api/bookmarks?readLater=true`)).json(); assert.equal(later.length,1);
    const updated=await (await fetch(`${base}/api/bookmarks/${item.id}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({...item,title:'Updated',tags:[]})})).json(); assert.equal(updated.title,'Updated');
    const removed=await fetch(`${base}/api/bookmarks/${item.id}`,{method:'DELETE'}); assert.equal(removed.status,200); assert.deepEqual(await (await fetch(`${base}/api/bookmarks`)).json(),[]);
    const page=await fetch(base); assert.equal(page.status,200); assert.match(await page.text(),/Keeplist/);
  } finally { child.kill('SIGTERM'); await fs.rm(directory,{recursive:true,force:true}); }
});
