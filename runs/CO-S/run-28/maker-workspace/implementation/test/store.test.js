import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Store, normalizeUrl, looksLikeUrl, canonical, normalizeTags } from '../store.js';

function tmpFile() { return join(tmpdir(), 'bm-store-' + randomUUID() + '.json'); }

test('normalizeUrl adds https:// when scheme missing (SCN-008)', () => {
  assert.equal(normalizeUrl('example.com/article'), 'https://example.com/article');
  assert.equal(normalizeUrl('http://x.com'), 'http://x.com');
  assert.equal(normalizeUrl('  '), '');
});

test('looksLikeUrl accepts real addresses, rejects junk (SCN-008)', () => {
  assert.equal(looksLikeUrl('https://example.com'), true);
  assert.equal(looksLikeUrl('https://example.com/a/b'), true);
  assert.equal(looksLikeUrl('https://notadomain'), false); // no dot
  assert.equal(looksLikeUrl('https://has space.com'), false);
  assert.equal(looksLikeUrl('not a url'), false);
});

test('canonical ignores www., trailing slash, case, and fragment (SCN-008)', () => {
  assert.equal(canonical('https://github.com'), canonical('https://www.github.com/'));
  assert.equal(canonical('https://GitHub.com/Repo'), canonical('https://github.com/Repo'));
  assert.equal(canonical('https://x.com/p#top'), canonical('https://x.com/p'));
  assert.notEqual(canonical('https://x.com/a?q=1'), canonical('https://x.com/a?q=2'));
});

test('normalizeTags trims, lower-cases, de-duplicates (SCN-003)', () => {
  assert.deepEqual(normalizeTags([' Work ', 'work', 'READ', '', 'read']), ['work', 'read']);
});

test('add: newest first, defaults, title falls back to url when blank (SCN-001/009)', () => {
  const f = tmpFile();
  try {
    const s = new Store(f);
    const a = s.add({ url: 'https://a.com', title: 'A', tags: ['x'] });
    const b = s.add({ url: 'https://b.com', title: '', tags: [] });
    assert.equal(s.all()[0].id, b.id, 'newest is first');
    assert.equal(a.toRead, false); assert.equal(a.archived, false);
    assert.equal(b.title, 'https://b.com', 'blank title falls back to the address');
  } finally { rmSync(f, { force: true }); }
});

test('update: empty title kept, tags normalized, flags toggle (SCN-002/005/006)', () => {
  const f = tmpFile();
  try {
    const s = new Store(f);
    const a = s.add({ url: 'https://a.com', title: 'Orig', tags: ['a'] });
    s.update(a.id, { title: '   ' });
    assert.equal(s.get(a.id).title, 'Orig', 'empty title keeps previous');
    s.update(a.id, { title: 'New', tags: ['B', 'b', 'c'] });
    assert.equal(s.get(a.id).title, 'New');
    assert.deepEqual(s.get(a.id).tags, ['b', 'c']);
    s.update(a.id, { toRead: true }); assert.equal(s.get(a.id).toRead, true);
    s.update(a.id, { archived: true }); assert.equal(s.get(a.id).archived, true);
    assert.equal(s.update('nope', { title: 'x' }), null);
  } finally { rmSync(f, { force: true }); }
});

test('findDuplicate matches by canonical form (SCN-008)', () => {
  const f = tmpFile();
  try {
    const s = new Store(f);
    s.add({ url: 'https://github.com', title: 'GH', tags: [] });
    assert.ok(s.findDuplicate('https://www.github.com/'));
    assert.ok(s.findDuplicate('HTTP://GitHub.com'));
    assert.equal(s.findDuplicate('https://gitlab.com'), null);
  } finally { rmSync(f, { force: true }); }
});

test('remove deletes permanently (SCN-007)', () => {
  const f = tmpFile();
  try {
    const s = new Store(f);
    const a = s.add({ url: 'https://a.com', title: 'A', tags: [] });
    assert.equal(s.remove(a.id), true);
    assert.equal(s.get(a.id), null);
    assert.equal(s.remove(a.id), false);
  } finally { rmSync(f, { force: true }); }
});

test('data persists across Store instances on the same file (SCN-010)', () => {
  const f = tmpFile();
  try {
    const s1 = new Store(f);
    s1.add({ url: 'https://a.com', title: 'A', tags: ['keep'] });
    const x = s1.add({ url: 'https://b.com', title: 'B', tags: [] });
    s1.update(x.id, { toRead: true, archived: true });
    const s2 = new Store(f); // simulates a restart / return later
    assert.equal(s2.all().length, 2);
    const reloaded = s2.get(x.id);
    assert.equal(reloaded.toRead, true);
    assert.equal(reloaded.archived, true);
    assert.deepEqual(s2.all().find((b) => b.url === 'https://a.com').tags, ['keep']);
  } finally { rmSync(f, { force: true }); }
});
