import test from 'node:test';import assert from 'node:assert/strict';import {normalizeBookmarkUrl,UrlValidationError} from '../../src/shared/url/normalize.ts';
test('adds https and canonicalizes default port',()=>{assert.equal(normalizeBookmarkUrl(' Example.com:443/path?q=1#part ').url,'https://example.com/path?q=1#part')});
test('keeps meaningful URL pieces',()=>{assert.equal(normalizeBookmarkUrl('http://example.com/a/?b=2#c').canonicalUrl,'http://example.com/a/?b=2#c')});
test('rejects unsafe schemes and credentials',()=>{assert.throws(()=>normalizeBookmarkUrl('file:///tmp/x'),UrlValidationError);assert.throws(()=>normalizeBookmarkUrl('https://a:b@example.com'),UrlValidationError)});
