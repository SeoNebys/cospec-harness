import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  normalizeUrl, isValidUrl, sameUrl, normalizeTags, parseTagString, hostOf,
} from '../lib/validate.js';
import { Store } from '../lib/store.js';
import { extractTitle, extractReadableText } from '../lib/fetchpage.js';

// ---- validate (SCN-008, SCN-002, SCN-007) ---------------------------------
test('normalizeUrl forgives a missing scheme (SCN-008)', () => {
  assert.equal(normalizeUrl('example.com/x'), 'https://example.com/x');
  assert.equal(normalizeUrl('http://a.com'), 'http://a.com');
  assert.equal(normalizeUrl('  '), '');
});

test('isValidUrl requires http(s) with a dotted host (SCN-008)', () => {
  assert.ok(isValidUrl('https://example.com/a'));
  assert.ok(!isValidUrl('not a url'));
  assert.ok(!isValidUrl('ftp://example.com'));
  assert.ok(!isValidUrl('https://localhost'));
});

test('sameUrl ignores trailing slash (SCN-007)', () => {
  assert.ok(sameUrl('https://a.com/p/', 'https://a.com/p'));
  assert.ok(!sameUrl('https://a.com/p', 'https://a.com/q'));
});

test('normalizeTags lower-cases and de-duplicates (SCN-002)', () => {
  assert.deepEqual(normalizeTags(['Work', 'work', '#Tech', ' ']), ['work', 'tech']);
  assert.deepEqual(parseTagString('a, B, a'), ['a', 'b']);
});

test('hostOf strips www', () => {
  assert.equal(hostOf('https://www.example.com/x'), 'example.com');
});

// ---- fetchpage parsing (SCN-001, SCN-005) ---------------------------------
test('extractTitle pulls and decodes the title (SCN-001)', () => {
  assert.equal(extractTitle('<html><head><title>Hello &amp; Bye</title></head>'), 'Hello & Bye');
  assert.equal(extractTitle('<html>no title</html>'), '');
});

test('extractReadableText strips markup (SCN-005)', () => {
  const txt = extractReadableText('<p>One</p><script>ignore()</script><p>Two</p>');
  assert.ok(txt.includes('One'));
  assert.ok(txt.includes('Two'));
  assert.ok(!txt.includes('ignore'));
});

// ---- store -----------------------------------------------------------------
function tmpStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmstore-'));
  return new Store(dir);
}

test('create rejects empty and invalid addresses (SCN-008)', () => {
  const s = tmpStore();
  assert.equal(s.create({ url: '' }).error, 'empty');
  assert.equal(s.create({ url: 'nonsense' }).error, 'invalid');
});

test('create defaults new links to "to read" and saves newest-first (SCN-004, SCN-001)', () => {
  const s = tmpStore();
  s.create({ url: 'https://a.com/1' });
  s.create({ url: 'https://a.com/2' });
  const list = s.list();
  assert.equal(list[0].url, 'https://a.com/2'); // newest first
  assert.equal(list[0].toread, true);
});

test('create respects toread=false and keepcopy (SCN-004, SCN-005)', () => {
  const s = tmpStore();
  const r = s.create({ url: 'https://a.com/x', toread: false, keepcopy: true });
  assert.equal(r.bookmark.toread, false);
  assert.equal(r.bookmark.keepcopy, true);
  assert.ok(r.bookmark.savedOn);
});

test('create prevents duplicates and returns the existing one (SCN-007)', () => {
  const s = tmpStore();
  s.create({ url: 'https://a.com/p' });
  const r = s.create({ url: 'https://a.com/p/' }); // trailing slash variant
  assert.equal(r.error, 'duplicate');
  assert.equal(r.existing.url, 'https://a.com/p');
});

test('update edits fields and validates address changes (SCN-006)', () => {
  const s = tmpStore();
  const a = s.create({ url: 'https://a.com/1' }).bookmark;
  const b = s.create({ url: 'https://a.com/2' }).bookmark;
  // valid change
  assert.equal(s.update(a.id, { title: 'T', tags: ['X', 'x'], url: 'https://a.com/1-moved' }).bookmark.title, 'T');
  assert.deepEqual(s.get(a.id).tags, ['x']);
  // invalid address
  assert.equal(s.update(a.id, { url: 'bad' }).error, 'invalid');
  // clash with another link
  assert.equal(s.update(a.id, { url: 'https://a.com/2' }).error, 'duplicate');
  assert.equal(b.url, 'https://a.com/2');
});

test('remove deletes permanently (SCN-010)', () => {
  const s = tmpStore();
  const a = s.create({ url: 'https://a.com/1' }).bookmark;
  assert.ok(s.remove(a.id).ok);
  assert.equal(s.get(a.id), null);
  assert.equal(s.remove(a.id).error, 'notfound');
});

test('data persists across store reloads (SCN-011)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmpersist-'));
  const s1 = new Store(dir);
  s1.create({ url: 'https://a.com/keep', title: 'Keep me', tags: ['t'] });
  const s2 = new Store(dir); // fresh instance reading the same files
  const list = s2.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].title, 'Keep me');
  assert.deepEqual(list[0].tags, ['t']);
});

test('snapshots are stored, read, and removed with the link (SCN-005, SCN-010)', () => {
  const s = tmpStore();
  const a = s.create({ url: 'https://a.com/1', keepcopy: true }).bookmark;
  s.setSnapshot(a.id, JSON.stringify({ ok: true, text: 'body' }));
  assert.ok(s.getSnapshot(a.id).includes('body'));
  s.remove(a.id);
  assert.equal(s.getSnapshot(a.id), null);
});
