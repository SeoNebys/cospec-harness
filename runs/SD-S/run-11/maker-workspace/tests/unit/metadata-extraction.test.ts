import test from 'node:test';import assert from 'node:assert/strict';import {extractMetadata} from '../../src/server/metadata/extract.ts';
test('extracts title and description as clean text',()=>{const r=extractMetadata(Buffer.from('<title>  A &amp; B </title><meta property="og:description" content=" A   useful page ">'));assert.deepEqual(r,{title:'A & B',description:'A useful page'})});
test('falls back and caps values',()=>{const r=extractMetadata(Buffer.from(`<meta property="og:title" content="${'x'.repeat(350)}"><meta name="description" content="desc">`));assert.equal(r.title?.length,300);assert.equal(r.description,'desc')});
test('returns null for missing metadata',()=>assert.deepEqual(extractMetadata(Buffer.from('<p>No head</p>')),{title:null,description:null}));
