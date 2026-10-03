import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery, SearchError } from '../src/search/parser.js';
import { matches } from '../src/search/evaluate.js';

function bm({ title = '', description = '', note = '', url = '', tags = [] }) {
  return {
    title,
    description,
    note_md: note,
    url,
    tagKeys: new Set(tags.map((t) => t.toLowerCase())),
  };
}

function run(query, bookmark) {
  return matches(parseQuery(query), bookmark);
}

test('empty query matches everything', () => {
  assert.equal(run('', bm({ title: 'anything' })), true);
});

test('case-insensitive word matches across fields', () => {
  assert.equal(run('RUST', bm({ description: 'learning rust lang' })), true);
  assert.equal(run('rust', bm({ note: 'A RUST note' })), true);
  assert.equal(run('rust', bm({ url: 'https://Rust-Lang.org' })), true);
  assert.equal(run('rust', bm({ title: 'go python' })), false);
});

test('#tag matches by identity', () => {
  assert.equal(run('#reading', bm({ tags: ['Reading'] })), true);
  assert.equal(run('#reading', bm({ tags: ['other'] })), false);
});

test('#tag combined with word requires both (implicit AND)', () => {
  const b = bm({ title: 'promise chains', tags: ['js'] });
  assert.equal(run('#js promise', b), true);
  assert.equal(run('#js promise', bm({ title: 'promise chains', tags: ['go'] })), false);
  assert.equal(run('#js promise', bm({ title: 'callbacks', tags: ['js'] })), false);
});

test('quoted phrase is an exact case-insensitive substring', () => {
  assert.equal(run('"machine learning"', bm({ description: 'intro to Machine Learning' })), true);
  assert.equal(run('"machine learning"', bm({ description: 'learning machine' })), false);
});

test('boolean operators with grouping', () => {
  const b = bm({ title: 'python flask tutorial' });
  assert.equal(run('python AND (flask OR django)', b), true);
  assert.equal(run('python AND (spring OR django)', b), false);
  assert.equal(run('docs NOT deprecated', bm({ title: 'docs guide' })), true);
  assert.equal(run('docs NOT deprecated', bm({ title: 'docs deprecated' })), false);
});

test('quoted AND/OR/NOT are literal words, not operators', () => {
  assert.equal(run('"this AND that"', bm({ title: 'this AND that here' })), true);
  assert.equal(run('#news "OR"', bm({ title: 'has OR word', tags: ['news'] })), true);
  assert.equal(run('#news "OR"', bm({ title: 'plain item', tags: ['news'] })), false);
});

test('invalid expressions throw a clear SearchError', () => {
  assert.throws(() => parseQuery('a AND (b OR c'), SearchError);
  assert.throws(() => parseQuery('a AND'), SearchError);
  assert.throws(() => parseQuery('()'), SearchError);
  assert.throws(() => parseQuery('"open phrase'), SearchError);
  assert.throws(() => parseQuery('OR foo'), SearchError);
});
