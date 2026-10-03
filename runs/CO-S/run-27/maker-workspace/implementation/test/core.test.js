import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BookmarkStore } from '../lib/store.js';
import { normalizeTag, normalizeTags } from '../lib/tags.js';
import { canonicalAddress, parseWebAddress } from '../lib/url.js';
import { extractMetadata, fetchMetadata } from '../lib/metadata.js';

async function withStore(run){ const directory=await fs.mkdtemp(path.join(os.tmpdir(),'keeplist-test-')); const store=new BookmarkStore(path.join(directory,'bookmarks.json')); await store.init(); try{return await run(store);}finally{await fs.rm(directory,{recursive:true,force:true});} }

test('validates and canonicalizes web addresses',()=>{
  assert.equal(canonicalAddress(' https://example.com/path '),'https://example.com/path');
  assert.throws(()=>parseWebAddress('not a web address'),/complete web address/);
  assert.throws(()=>parseWebAddress('file:///tmp/test'),/http/);
});

test('normalizes tags and removes near-duplicates',()=>{
  assert.equal(normalizeTag(' Reference  Material '),'reference material');
  assert.deepEqual(normalizeTags(['Reference',' reference ','Web Design']),['reference','web design']);
});

test('extracts page metadata and falls back when fetching fails',async()=>{
  const html='<html><head><title>Fallback title</title><meta name="description" content="Useful &amp; clear"><meta property="og:title" content="Preferred title"></head></html>';
  assert.deepEqual(extractMetadata(html,'https://example.com'),{title:'Preferred title',description:'Useful & clear'});
  const fallback=await fetchMetadata('https://example.com/article',async()=>{throw new Error('offline');});
  assert.deepEqual(fallback,{title:'example.com',description:'',fetched:false});
});

test('creates, finds, searches, tags, edits, marks and deletes bookmarks',async()=>withStore(async store=>{
  const first=await store.create({url:'https://example.com/grid',title:'Grid guide',description:'Rows and columns',tags:['Web Design','Reference']});
  const second=await store.create({url:'https://example.com/essay',title:'An essay',description:'Long-form reading',tags:[]});
  assert.deepEqual((await store.list({query:'columns'})).map(item=>item.id),[first.id]);
  assert.deepEqual((await store.list({query:'web design'})).map(item=>item.id),[first.id]);
  assert.deepEqual((await store.list({tag:'web design'})).map(item=>item.id),[first.id]);
  assert.deepEqual(await store.tags(),['reference','web design']);
  await assert.rejects(()=>store.create({url:first.url,title:'Copy'}),error=>error.code==='DUPLICATE');
  const marked=await store.toggleReadLater(second.id); assert.equal(marked.readLater,true); assert.deepEqual((await store.list({readLater:true})).map(item=>item.id),[second.id]);
  const updated=await store.update(first.id,{url:first.url,title:'Updated grid guide',description:first.description,tags:[' Reference ' ]}); assert.equal(updated.title,'Updated grid guide'); assert.deepEqual(updated.tags,['reference']);
  await store.remove(first.id); assert.equal((await store.all()).length,1);
}));
