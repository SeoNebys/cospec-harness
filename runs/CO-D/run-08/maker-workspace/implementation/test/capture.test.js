import test from 'node:test';
import assert from 'node:assert/strict';
import { capturePage } from '../lib/capture.js';

test('extracts metadata and sanitizes a readable copy', async () => {
  const fakeFetch = async () => ({ ok:true, url:'https://example.com/post', headers:new Headers({'content-type':'text/html'}), text:async()=>`<html><head><title>Useful page</title><meta name="description" content="A useful description"></head><body><nav>menu</nav><article><h1>Useful page</h1><p>Readable text.</p><script>alert(1)</script><a href="/more">More</a></article></body></html>` });
  const result = await capturePage('https://example.com/post', fakeFetch);
  assert.equal(result.title, 'Useful page');
  assert.equal(result.description, 'A useful description');
  assert.match(result.snapshot, /Readable text/);
  assert.match(result.snapshot, /https:\/\/example.com\/more/);
  assert.doesNotMatch(result.snapshot, /script|alert/);
});
