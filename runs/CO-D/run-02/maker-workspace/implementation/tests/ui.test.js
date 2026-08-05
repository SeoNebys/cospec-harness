'use strict';
/*
 * UI integration tests — load the real index.html + scripts into a simulated
 * browser (jsdom) and drive the actual interactions, verifying the DOM wiring
 * end to end. Requires jsdom (installed as a dev dependency for testing only).
 */
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }

const DIR = path.join(__dirname, '..');
function read(f) { return fs.readFileSync(path.join(DIR, f), 'utf8'); }

function boot(preload) {
  // Strip the external <script> tags and inject the files via win.eval so that
  // their contents never pass through the HTML parser (avoids any in-source
  // "</scr"+"ipt>" truncation, and jsdom won't try to fetch local files).
  const html = read('index.html').replace(/\s*<script src="src\/[^"]*"><\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true });
  const win = dom.window;
  win.scrollTo = function () {};
  win.HTMLElement.prototype.scrollIntoView = function () {};
  // Simulate a "reopen": preload localStorage before the app scripts run.
  if (preload) Object.keys(preload).forEach(k => win.localStorage.setItem(k, preload[k]));
  win.eval(read('src/core.js'));
  win.eval(read('src/store.js'));
  win.eval(read('src/app.js'));
  return { dom, win, doc: win.document };
}

function snapshot(win) {
  const out = {};
  for (let i = 0; i < win.localStorage.length; i++) { const k = win.localStorage.key(i); out[k] = win.localStorage.getItem(k); }
  return out;
}

function type(win, el, val) { el.value = val; el.dispatchEvent(new win.Event('input', { bubbles: true })); }
function cards(doc) { return Array.from(doc.querySelectorAll('#list > li')); }

test('UI: day one shows the welcome and hides the search box (SCN-007)', { skip: !JSDOM }, () => {
  const { doc } = boot();
  assert.match(doc.getElementById('empty').textContent, /Nothing saved yet/);
  assert.equal(doc.getElementById('searchBar').style.display, 'none');
});

test('UI: add a bookmark, then find it by its own note (SCN-004 + SCN-001)', { skip: !JSDOM }, () => {
  const { win, doc } = boot();
  doc.getElementById('addBtn').click();
  type(win, doc.getElementById('url'), 'https://smittenkitchen.com/olive-oil-cake');
  // autofilled preview should be showing and enabled
  assert.ok(doc.getElementById('preview').classList.contains('show'));
  type(win, doc.getElementById('fNote'), "the cake I'm making for Sarah's birthday");
  doc.getElementById('saveBtn').click();
  assert.equal(cards(doc).length, 1);
  // search by the client's own word
  type(win, doc.getElementById('q'), 'sarah');
  assert.equal(cards(doc).length, 1);
  type(win, doc.getElementById('q'), 'nonsense-xyz');
  assert.equal(cards(doc).length, 0);
  assert.match(doc.getElementById('empty').textContent, /Nothing to show/);
});

test('UI: duplicate paste does not pile up, offers the existing one (SCN-004)', { skip: !JSDOM }, () => {
  const { win, doc } = boot();
  doc.getElementById('addBtn').click();
  type(win, doc.getElementById('url'), 'https://smittenkitchen.com/olive-oil-cake');
  doc.getElementById('saveBtn').click();
  doc.getElementById('addBtn').click();
  type(win, doc.getElementById('url'), 'http://www.smittenkitchen.com/olive-oil-cake/');
  assert.notEqual(doc.getElementById('dupe').style.display, 'none', 'duplicate notice shown');
  assert.ok(doc.getElementById('saveBtn').disabled, 'cannot save a duplicate');
});

test('UI: not-a-link is nudged, a real link degrades gracefully (SCN-008)', { skip: !JSDOM }, () => {
  const { win, doc } = boot();
  doc.getElementById('addBtn').click();
  type(win, doc.getElementById('url'), 'olive oil cake recipe');
  assert.notEqual(doc.getElementById('urlHint').style.display, 'none');
  assert.ok(doc.getElementById('saveBtn').disabled);
  type(win, doc.getElementById('url'), 'https://some-tiny-blog.example/posts/12345');
  assert.ok(doc.getElementById('preview').classList.contains('show'));
  assert.ok(!doc.getElementById('saveBtn').disabled, 'can still save an unreadable page');
  assert.equal(doc.getElementById('fTitle').value, '', 'title left for the client');
});

test('UI: reading pile flags on save, filters, and clears itself (SCN-010)', { skip: !JSDOM }, () => {
  const { win, doc } = boot();
  doc.getElementById('addBtn').click();
  type(win, doc.getElementById('url'), 'https://some-blog.example/essay');
  type(win, doc.getElementById('fTitle'), 'A long essay');
  doc.getElementById('fUnread').click();
  doc.getElementById('saveBtn').click();
  // "To read (1)" pill present
  assert.match(doc.getElementById('readBar').textContent, /To read \(1\)/);
  // open the pile
  doc.getElementById('readToggle').click();
  assert.equal(cards(doc).length, 1);
  // mark read -> pile empties, "all caught up"
  doc.querySelector('#list .mark-read').click();
  assert.match(doc.getElementById('empty').textContent, /caught up/i);
});

test('UI: roundup by label, and narrow within it (SCN-002)', { skip: !JSDOM }, () => {
  const { win, doc } = boot();
  function add(url, title, label) {
    doc.getElementById('addBtn').click();
    type(win, doc.getElementById('url'), url);
    type(win, doc.getElementById('fTitle'), title);
    type(win, doc.getElementById('labelInput'), label);
    doc.getElementById('labelInput').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter' }));
    doc.getElementById('saveBtn').click();
  }
  add('https://a.example/pasta', 'Pasta night', 'recipe');
  add('https://b.example/bread', 'Bread loaf', 'recipe');
  add('https://c.example/react', 'React app', 'work');
  // roundup recipe
  const recipeBtn = Array.from(doc.querySelectorAll('.filter')).find(b => b.textContent === 'recipe');
  recipeBtn.click();
  assert.equal(cards(doc).length, 2);
  // narrow within
  type(win, doc.getElementById('q'), 'bread');
  assert.equal(cards(doc).length, 1);
});

test('UI: set aside then delete-with-undo (SCN-006)', { skip: !JSDOM }, () => {
  const { win, doc } = boot();
  doc.getElementById('addBtn').click();
  type(win, doc.getElementById('url'), 'https://a.example/x');
  type(win, doc.getElementById('fTitle'), 'Thing X');
  doc.getElementById('saveBtn').click();

  // set aside via Edit details
  doc.querySelector('#list .edit-btn').click();
  doc.getElementById('asideBtn').click();
  assert.equal(cards(doc).length, 0);
  assert.match(doc.getElementById('empty').textContent, /tucked away/i);
  // undo from toast
  doc.getElementById('toastUndo').click();
  assert.equal(cards(doc).length, 1);

  // delete for good (two clicks) then undo
  doc.querySelector('#list .edit-btn').click();
  const del = doc.getElementById('deleteBtn');
  del.click(); del.click();
  assert.equal(cards(doc).length, 0);
  doc.getElementById('toastUndo').click();
  assert.equal(cards(doc).length, 1);
});

test('UI: saved bookmarks survive closing and reopening the app (persistence — the acceptance blocker)', { skip: !JSDOM }, () => {
  // Visit 1: save a couple of things, edit and tidy.
  const v1 = boot();
  function add(url, title, note) {
    v1.doc.getElementById('addBtn').click();
    type(v1.win, v1.doc.getElementById('url'), url);
    type(v1.win, v1.doc.getElementById('fTitle'), title);
    if (note) type(v1.win, v1.doc.getElementById('fNote'), note);
    v1.doc.getElementById('saveBtn').click();
  }
  add('https://smittenkitchen.com/olive-oil-cake', 'Olive oil cake', "for Sarah's birthday");
  add('https://a.example/essay', 'A long essay');
  assert.equal(cards(v1.doc).length, 2);
  const saved = snapshot(v1.win);
  v1.win.close();

  // Visit 2 (a "tomorrow"): reopen with the same browser storage.
  const v2 = boot(saved);
  assert.equal(cards(v2.doc).length, 2, 'both bookmarks are still there after reopening');
  assert.ok(!v2.doc.getElementById('storageWarn').style.display || v2.doc.getElementById('storageWarn').style.display === 'none', 'no lost-data warning when storage works');
  // still findable by the client's own note
  type(v2.win, v2.doc.getElementById('q'), 'sarah');
  assert.equal(cards(v2.doc).length, 1);
  assert.match(v2.doc.querySelector('#list .title').textContent, /Olive oil cake/);
});

test('UI: warns (never silently loses) when storage is not durable', { skip: !JSDOM }, () => {
  const html = read('index.html').replace(/\s*<script src="src\/[^"]*"><\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true });
  const win = dom.window;
  win.scrollTo = function () {}; win.HTMLElement.prototype.scrollIntoView = function () {};
  // Make storage look blocked.
  Object.defineProperty(win, 'localStorage', { get() { throw new Error('blocked'); } });
  win.eval(read('src/core.js')); win.eval(read('src/store.js')); win.eval(read('src/app.js'));
  assert.equal(win.document.getElementById('storageWarn').style.display, 'block', 'a clear warning is shown');
});

test('UI: order control reorders and persists label choice (SCN-009)', { skip: !JSDOM }, () => {
  const { win, doc } = boot();
  function add(url, title) { doc.getElementById('addBtn').click(); type(win, doc.getElementById('url'), url); type(win, doc.getElementById('fTitle'), title); doc.getElementById('saveBtn').click(); }
  add('https://a.example/1', 'Zebra');
  add('https://a.example/2', 'Apple');
  // newest first => Apple on top
  assert.equal(cards(doc)[0].querySelector('.title').textContent.trim(), 'Apple');
  type(win, doc.getElementById('sortSel'), 'az'); // A-Z
  doc.getElementById('sortSel').dispatchEvent(new win.Event('change'));
  assert.equal(cards(doc)[0].querySelector('.title').textContent.trim(), 'Apple');
  type(win, doc.getElementById('sortSel'), 'oldest');
  doc.getElementById('sortSel').dispatchEvent(new win.Event('change'));
  assert.equal(cards(doc)[0].querySelector('.title').textContent.trim(), 'Zebra');
  assert.equal(win.localStorage.getItem('bm_sort'), 'oldest', 'preference remembered');
});
