import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchMetadata } from '../metadata.mjs';

test('SCN-001 extracts title, description, supplied icon, and thumbnail',async()=>{
  const html='<html><head><title>Fallback</title><meta property="og:title" content="Fetched title"><meta name="description" content="Fetched description"><meta property="og:image" content="/cover.jpg"><link rel="icon" href="/mark.png"></head></html>';
  const fake=async()=>new Response(html,{status:200,headers:{'content-type':'text/html'}});
  const result=await fetchMetadata('https://example.com/article',fake);
  assert.equal(result.title,'Fetched title'); assert.equal(result.description,'Fetched description'); assert.equal(result.thumbnail,'https://example.com/cover.jpg'); assert.equal(result.favicon,'https://example.com/mark.png');
});
test('SCN-001 omits imagery the page does not supply',async()=>{ const fake=async()=>new Response('<title>Plain page</title>',{status:200,headers:{'content-type':'text/html'}}); const result=await fetchMetadata('https://example.com',fake); assert.equal(result.thumbnail,''); assert.equal(result.favicon,''); });
