const STORAGE_KEY = 'keepsake.bookmarks.v1';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let bookmarks = loadBookmarks();
let currentView = 'all';
let query = '';
let editingId = null;
let deletingId = null;

function loadBookmarks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks)); }
function validAddress(value) { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } }
function normalized(value) { const url = new URL(value); url.hash = ''; if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/$/, ''); return url.href; }
function escapeHtml(value = '') { return value.replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
function initials(url) { const host = new URL(url).hostname.replace(/^www\./,''); return host.split('.')[0].slice(0,2) || '↗'; }
function setStatus(target, message = '', kind = '') { target.textContent = message; target.className = `status ${kind}`.trim(); }

function visibleBookmarks() {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return bookmarks.filter(bookmark => {
    if (currentView === 'all' && bookmark.archived) return false;
    if (currentView === 'later' && (bookmark.archived || !bookmark.readLater)) return false;
    if (currentView === 'archive' && !bookmark.archived) return false;
    const haystack = `${bookmark.title} ${bookmark.tags.join(' ')}`.toLowerCase();
    return words.every(word => haystack.includes(word));
  });
}

function render() {
  $('#all-count').textContent = bookmarks.filter(item => !item.archived).length;
  $('#later-count').textContent = bookmarks.filter(item => item.readLater && !item.archived).length;
  $('#archive-count').textContent = bookmarks.filter(item => item.archived).length;
  $$('.view').forEach(button => button.classList.toggle('active', button.dataset.view === currentView));
  const items = visibleBookmarks();
  $('#collection').innerHTML = items.map(bookmarkCard).join('');
  const empty = $('#empty');
  empty.hidden = items.length !== 0;
  if (!items.length) {
    let title = 'No bookmarks yet'; let copy = 'Paste a web address above to save your first link.';
    if (query) { title = 'No bookmarks match'; copy = 'Try another title or tag. Your search box is ready when you are.'; }
    else if (currentView === 'later') { title = 'Your reading list is empty'; copy = 'Mark a bookmark “Read later” to see it here.'; }
    else if (currentView === 'archive') { title = 'Your archive is empty'; copy = 'Bookmarks you set aside will appear here.'; }
    $('h3', empty).textContent = title; $('p', empty).textContent = copy;
  }
  bindCards();
}

function bookmarkCard(bookmark) {
  const tags = bookmark.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  const action = bookmark.archived
    ? `<button class="restore" data-action="restore">Restore</button>`
    : `<button class="later ${bookmark.readLater ? 'marked' : ''}" data-action="later">${bookmark.readLater ? '✓ In reading list' : 'Read later'}</button><button class="manage-toggle" data-action="manage">Manage</button><div class="manage-menu" hidden><button data-action="edit">Edit</button><button data-action="archive">Archive</button><button class="danger-text" data-action="delete">Delete</button></div>`;
  return `<article class="bookmark" data-id="${bookmark.id}"><div class="site-mark">${escapeHtml(initials(bookmark.url))}</div><div><h3 title="${escapeHtml(bookmark.title)}">${escapeHtml(bookmark.title)}</h3>${bookmark.description ? `<p class="description">${escapeHtml(bookmark.description)}</p>` : `<p class="description">Page details unavailable. You can edit this bookmark later.</p>`}<p class="address">${escapeHtml(bookmark.url)}</p><div class="tags">${tags}<button class="tag-add" data-action="tag">+ Add a tag</button></div></div><div class="card-actions">${action}</div></article>`;
}

function bindCards() {
  $$('.bookmark').forEach(card => card.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    const bookmark = bookmarks.find(item => item.id === card.dataset.id); if (!bookmark) return;
    const action = button.dataset.action;
    if (action === 'later') { bookmark.readLater = !bookmark.readLater; persist(); render(); }
    if (action === 'manage') { const menu = $('.manage-menu', card); menu.hidden = !menu.hidden; }
    if (action === 'edit') { editingId = bookmark.id; $('#edit-title').value = bookmark.title; $('#edit-url').value = bookmark.url; setStatus($('#edit-status')); $('#edit-dialog').showModal(); }
    if (action === 'archive') { bookmark.archived = true; persist(); render(); setStatus($('#save-status'), 'Bookmark moved to Archive. It is no longer in All bookmarks.', 'success'); }
    if (action === 'restore') { bookmark.archived = false; persist(); render(); setStatus($('#save-status'), 'Bookmark restored to All bookmarks.', 'success'); }
    if (action === 'delete') { deletingId = bookmark.id; $('#delete-dialog').showModal(); }
    if (action === 'tag') showTagEditor(card, bookmark);
  }));
}

function showTagEditor(card, bookmark) {
  const tags = $('.tags', card); const trigger = $('.tag-add', tags);
  trigger.hidden = true;
  const editor = document.createElement('div'); editor.className = 'tag-editor';
  editor.innerHTML = '<input aria-label="Tag name" placeholder="Tag name"><button type="button">Add</button>';
  tags.append(editor); const input = $('input', editor); input.focus();
  $('button', editor).addEventListener('click', () => {
    const name = input.value.trim(); if (!name) return;
    if (bookmark.tags.some(tag => tag.toLowerCase() === name.toLowerCase())) { setStatus($('#save-status'), 'This bookmark already has that tag.', 'error'); return; }
    bookmark.tags.push(name); persist(); render(); setStatus($('#save-status'), `Tag “${name}” added.`, 'success');
  });
}

$('#save-form').addEventListener('submit', async event => {
  event.preventDefault(); const input = $('#save-url'); const status = $('#save-status'); const button = $('#save-button'); const raw = input.value.trim();
  setStatus(status);
  if (!validAddress(raw)) { setStatus(status, 'Enter a complete web address, such as https://example.com', 'error'); input.focus(); return; }
  const url = normalized(raw); const existing = bookmarks.find(item => normalized(item.url) === url);
  if (existing) { setStatus(status, 'This address is already saved. We highlighted the existing bookmark.', 'error'); currentView = existing.archived ? 'archive' : 'all'; query = ''; $('#search').value = ''; render(); requestAnimationFrame(() => { const card = $(`.bookmark[data-id="${existing.id}"]`); card?.classList.add('highlight'); card?.scrollIntoView({behavior:'smooth',block:'center'}); }); return; }
  button.disabled = true; button.textContent = 'Getting details…'; setStatus(status, 'Reading the page details…');
  let details; let unavailable = false;
  try { const response = await fetch('/api/metadata', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({url}) }); if (!response.ok) throw new Error(); details = await response.json(); unavailable = details.unavailable; }
  catch { details = { title:new URL(url).hostname.replace(/^www\./,''), description:'' }; unavailable = true; }
  const bookmark = { id:crypto.randomUUID(), url, title:details.title || new URL(url).hostname, description:details.description || '', tags:[], readLater:false, archived:false, createdAt:new Date().toISOString() };
  bookmarks.unshift(bookmark); persist(); currentView = 'all'; query = ''; $('#search').value = ''; render(); input.value = '';
  setStatus(status, unavailable ? 'Bookmark saved, but its page details could not be retrieved.' : 'Bookmark saved with its page details.', 'success'); button.disabled = false; button.innerHTML = 'Save bookmark <span>↗</span>';
});

$('#search').addEventListener('input', event => { query = event.target.value; render(); });
$$('.view').forEach(button => button.addEventListener('click', () => { currentView = button.dataset.view; render(); }));

$('#edit-form').addEventListener('submit', event => {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') { $('#edit-dialog').close(); return; }
  const title = $('#edit-title').value.trim(); const url = $('#edit-url').value.trim();
  if (!title) { setStatus($('#edit-status'), 'Enter a title before saving changes.', 'error'); return; }
  if (!validAddress(url)) { setStatus($('#edit-status'), 'Enter a complete web address before saving changes.', 'error'); $('#edit-url').focus(); return; }
  const bookmark = bookmarks.find(item => item.id === editingId); bookmark.title = title; bookmark.url = normalized(url); persist(); $('#edit-dialog').close(); render(); setStatus($('#save-status'), 'Changes saved.', 'success');
});

$('#delete-dialog').addEventListener('close', () => {
  if ($('#delete-dialog').returnValue === 'confirm') { bookmarks = bookmarks.filter(item => item.id !== deletingId); persist(); render(); setStatus($('#save-status'), 'Bookmark deleted permanently.', 'success'); }
  deletingId = null;
});

render();
$('main').setAttribute('data-harness-ready', 'true');
