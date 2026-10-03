import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BookmarkStore, canonicalTag, normalizeUrl } from '../store.mjs';

async function fresh(){ const dir=await mkdtemp(path.join(os.tmpdir(),'keepsake-')); const store=new BookmarkStore(path.join(dir,'bookmarks.json')); await store.load(); return store; }
const sample=(url='https://example.com/article')=>({url,title:'Edited title',description:'Edited description',noteHtml:'<strong>Remember</strong><ul><li>Read it</li></ul>',tags:['Reading'],siteName:'example.com'});

test('SCN-001 saves exact edited details and optional media',async()=>{ const store=await fresh(); const item=await store.create({...sample(),thumbnail:'https://example.com/image.jpg'}); assert.equal(item.title,'Edited title'); assert.equal(item.description,'Edited description'); assert.match(item.noteHtml,/strong/); assert.equal(item.thumbnail,'https://example.com/image.jpg'); });
test('SCN-002 normalizes superficial URL differences but preserves different paths',()=>{ assert.equal(normalizeUrl('https://EXAMPLE.com/article/?utm_source=x#part'),normalizeUrl('https://example.com/article')); assert.notEqual(normalizeUrl('https://example.com/one'),normalizeUrl('https://example.com/two')); });
test('SCN-002 rejects duplicate normalized pages',async()=>{ const store=await fresh(); await store.create(sample()); await assert.rejects(()=>store.create(sample('https://example.com/article/?utm_source=x#part')),error=>error.code==='DUPLICATE'); });
test('SCN-005 canonicalizes case and simple singular plural tags',()=>{ assert.equal(canonicalTag('recipe',['Recipes']),'Recipes'); assert.equal(canonicalTag('READING',['Reading']),'Reading'); });
test('SCN-006 read later can be marked and cleared',async()=>{ const store=await fresh(); const item=await store.create(sample()); assert.equal((await store.update(item.id,{readLater:true})).readLater,true); assert.equal((await store.update(item.id,{readLater:false})).readLater,false); });
test('SCN-008 archive and restore preserve all content',async()=>{ const store=await fresh(); const item=await store.create(sample()); const archived=await store.update(item.id,{archived:true}); const restored=await store.update(item.id,{archived:false}); assert.equal(archived.archived,true); assert.equal(restored.archived,false); assert.equal(restored.noteHtml,item.noteHtml); assert.deepEqual(restored.tags,item.tags); });
test('SCN-009 permanent delete is restricted to archived bookmarks',async()=>{ const store=await fresh(); const item=await store.create(sample()); await assert.rejects(()=>store.deleteArchived([item.id])); await store.update(item.id,{archived:true}); assert.equal(await store.deleteArchived([item.id]),1); assert.equal(store.all().length,0); });
test('SCN-014 archived bookmarks are still found as duplicates',async()=>{ const store=await fresh(); const item=await store.create(sample()); await store.update(item.id,{archived:true}); assert.equal(store.findByUrl('https://example.com/article/#part').id,item.id); });
test('SCN-017 bulk actions touch only selected bookmarks and preserve tags',async()=>{ const store=await fresh(); const one=await store.create(sample('https://example.com/one')); const two=await store.create({...sample('https://example.com/two'),tags:['Recipes']}); const three=await store.create(sample('https://example.com/three')); await store.bulk([one.id,two.id],'addTag','Work'); assert.deepEqual(store.get(one.id).tags,['Reading','Work']); assert.deepEqual(store.get(two.id).tags,['Recipes','Work']); assert.deepEqual(store.get(three.id).tags,['Reading']); });
