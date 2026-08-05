// Tests for Slice 2 (labels, note formatting) + spine fixes (YouTube oEmbed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTag, addTag, suggestTags, sanitizeNote, oembedEndpoint, makeLink,
} from '../extension/src/core.js';

test('SCN-006: labels normalise and never duplicate', () => {
  assert.equal(normalizeTag('  Recipes '), 'recipes');
  let tags = addTag([], 'Recipes');
  tags = addTag(tags, 'recipes');      // same, case/space-insensitive
  tags = addTag(tags, 'baking');
  assert.deepEqual(tags, ['recipes', 'baking']);
});

test('SCN-006: suggestions steer to existing labels (avoid near-duplicates)', () => {
  const all = ['baking', 'recipes', 'reading'];
  assert.deepEqual(suggestTags(all, 'rec', []), ['recipes']);
  assert.deepEqual(suggestTags(all, 're', []), ['recipes', 'reading']);
  assert.deepEqual(suggestTags(all, '', ['baking']), ['recipes', 'reading']); // chosen excluded
});

test('SCN-019: note keeps only bold + lists, strips everything else', () => {
  const dirty = '<p>Read <b>before</b> the <i>review</i></p><ul><li>one</li></ul><script>evil()</script><a href="x">link</a>';
  const clean = sanitizeNote(dirty);
  assert.ok(clean.includes('<b>before</b>'));
  assert.ok(clean.includes('<ul><li>one</li></ul>'));
  assert.ok(!/<i>|<\/i>/.test(clean));      // italics dropped
  assert.ok(!/script/i.test(clean));        // script stripped
  assert.ok(!/<a|href/i.test(clean));       // links stripped
});

test('YouTube links resolve to an oEmbed endpoint (real title, no login)', () => {
  assert.ok(oembedEndpoint('https://www.youtube.com/watch?v=dQw4w9WgXcQ').includes('youtube.com/oembed'));
  assert.ok(oembedEndpoint('https://youtu.be/dQw4w9WgXcQ').includes('youtube.com/oembed'));
  assert.equal(oembedEndpoint('https://example.com/watch?v=x'), null);
  assert.equal(oembedEndpoint('https://www.youtube.com/'), null); // channel/home, not a video
});

test('a fresh link starts with an empty note and no labels', () => {
  const l = makeLink('example.com', { ok: true, title: 'Example' }, 1);
  assert.equal(l.note, '');
  assert.deepEqual(l.tags, []);
});
