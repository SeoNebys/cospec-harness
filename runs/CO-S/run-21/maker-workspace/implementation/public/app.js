const state = { view: 'all', tag: '', query: '', sort: 'added', bookmarks: [], tags: [], counts: {}, selected: new Set() };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.hidden = false;
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => { toast.hidden = true; }, 3300);
}

function closeDialog() { $('#dialog-layer').hidden = true; $('#dialog').innerHTML = ''; }
function openDialog(content) { $('#dialog').innerHTML = content; $('#dialog-layer').hidden = false; }
function escapeHtml(value) { const node = document.createElement('div'); node.textContent = String(value ?? ''); return node.innerHTML; }
function age(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'Just now'; if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24); return days === 1 ? 'Yesterday' : `${days}d ago`;
}

async function load() {
  const params = new URLSearchParams({ view: state.view, q: state.query, sort: state.sort });
  if (state.tag) params.set('tag', state.tag);
  const data = await request(`/api/bookmarks?${params}`);
  Object.assign(state, data); state.selected.clear(); render();
}

function render() {
  const titles = { all: 'All bookmarks', readLater: 'Read later', archive: 'Archive' };
  const subtitles = { all: 'Everything you’ve saved, newest first.', readLater: `${state.counts.readLater || 0} link${state.counts.readLater === 1 ? '' : 's'} waiting for you.`, archive: 'Set aside, kept safe, and ready to restore.' };
  $('#page-title').textContent = state.tag || titles[state.view];
  $('#page-subtitle').textContent = subtitles[state.view];
  $('#result-context').textContent = state.query ? `Results for “${state.query}”` : (state.tag || titles[state.view]);
  $('#result-count').textContent = `${state.bookmarks.length} bookmark${state.bookmarks.length === 1 ? '' : 's'}`;
  $$('[data-count]').forEach((node) => { node.textContent = state.counts[node.dataset.count] || 0; });
  $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view));
  renderTags(); renderCards(); renderEmpty(); updateBulk();
  $('.main').dataset.harnessReady = 'true';
}

function renderTags() {
  const list = $('#tag-list'); list.innerHTML = '';
  state.tags.forEach((tag) => {
    const button = document.createElement('button'); button.className = 'tag-filter'; button.dataset.tag = tag; button.textContent = tag;
    if (tag === state.tag) button.classList.add('active');
    button.addEventListener('click', () => { state.tag = tag; load(); }); list.appendChild(button);
  });
  $$('.tag-filter[data-tag=""]').forEach((button) => button.classList.toggle('active', !state.tag));
}

function renderCards() {
  const list = $('#bookmark-list'); list.innerHTML = '';
  state.bookmarks.forEach((bookmark) => {
    const card = $('#card-template').content.firstElementChild.cloneNode(true); card.dataset.id = bookmark.id;
    const checkbox = $('.select-bookmark', card); checkbox.checked = state.selected.has(bookmark.id); checkbox.ariaLabel = `Select ${bookmark.title}`;
    checkbox.addEventListener('change', () => { checkbox.checked ? state.selected.add(bookmark.id) : state.selected.delete(bookmark.id); card.classList.toggle('selected', checkbox.checked); updateBulk(); });
    const image = $('.card-media img', card); if (bookmark.imageUrl) { image.src = bookmark.imageUrl; image.hidden = false; $('.media-fallback', card).hidden = true; image.addEventListener('error', () => { image.hidden = true; $('.media-fallback', card).hidden = false; }); }
    const icon = $('.site-icon', card); if (bookmark.iconUrl) { icon.src = bookmark.iconUrl; icon.hidden = false; icon.addEventListener('error', () => { icon.hidden = true; }); }
    $('.site-name', card).textContent = bookmark.siteName; $('time', card).textContent = age(bookmark.createdAt);
    const title = $('.bookmark-title', card); title.textContent = bookmark.title; title.href = bookmark.url;
    $('.bookmark-description', card).textContent = bookmark.description || 'No description yet.';
    $('.bookmark-url', card).textContent = bookmark.url;
    if (bookmark.enrichment === 'fallback') $('.fallback-notice', card).hidden = false;
    if (bookmark.note) { const note = $('.note-block', card); note.textContent = bookmark.note; note.hidden = false; }
    const tags = $('.tag-row', card); bookmark.tags.forEach((tag) => { const pill = document.createElement('button'); pill.className = 'tag-pill'; pill.textContent = tag; pill.addEventListener('click', () => { state.tag = tag; load(); }); tags.appendChild(pill); });
    const later = $('.read-later-action', card);
    if (state.view === 'archive') { later.textContent = 'Restore'; later.addEventListener('click', () => patchBookmark(bookmark.id, { archived: false }, 'Restored to All bookmarks')); }
    else if (state.view === 'readLater') { later.textContent = '✓ Mark as read'; later.addEventListener('click', () => patchBookmark(bookmark.id, { readLater: false }, 'Marked as read · Bookmark remains in All bookmarks')); }
    else { later.textContent = bookmark.readLater ? '◷ In Read later' : '◷ Read later'; later.classList.toggle('active', bookmark.readLater); later.addEventListener('click', () => patchBookmark(bookmark.id, { readLater: !bookmark.readLater }, bookmark.readLater ? 'Removed from Read later' : 'Added to Read later')); }
    const more = $('.more-action', card); const menu = $('.card-menu', card); more.addEventListener('click', () => { $$('.card-menu').forEach((other) => { if (other !== menu) other.hidden = true; }); menu.hidden = !menu.hidden; });
    buildMenu(menu, bookmark, card); list.appendChild(card);
  });
}

function menuButton(label, action, className = '') { const button = document.createElement('button'); button.textContent = label; button.className = className; button.addEventListener('click', action); return button; }
function buildMenu(menu, bookmark, card) {
  menu.append(menuButton('Edit title & description', () => editInline(bookmark, card)));
  menu.append(menuButton(bookmark.note ? 'Edit note' : 'Add a note', () => noteDialog(bookmark)));
  menu.append(menuButton('Add tag', () => tagDialog([bookmark.id], `Tag “${bookmark.title}”`)));
  if (bookmark.enrichment === 'fallback') menu.append(menuButton('Try gathering details again', () => retryDetails(bookmark)));
  if (state.view !== 'archive') menu.append(menuButton('Move to Archive', () => patchBookmark(bookmark.id, { archived: true }, 'Moved to Archive · Kept safe')));
  menu.append(menuButton('Delete permanently…', () => deleteDialog([bookmark], false), 'danger-text'));
}

function editInline(bookmark, card) {
  $('.card-menu', card).hidden = true; const editor = $('.inline-editor', card); editor.hidden = false;
  editor.innerHTML = `<label>Title</label><input value="${escapeHtml(bookmark.title)}"><label>Description</label><textarea rows="3">${escapeHtml(bookmark.description)}</textarea><div class="inline-actions"><button class="secondary" data-cancel>Cancel</button><button class="primary" data-save>Save changes</button></div>`;
  $('[data-cancel]', editor).addEventListener('click', () => { editor.hidden = true; });
  $('[data-save]', editor).addEventListener('click', async () => { await patchBookmark(bookmark.id, { title: $('input', editor).value.trim(), description: $('textarea', editor).value.trim() }, 'Bookmark details updated'); });
}

function noteDialog(bookmark) {
  openDialog(`<h2>${bookmark.note ? 'Edit your note' : 'Add context for later'}</h2><p>${escapeHtml(bookmark.title)}</p><label for="note-value">Your note</label><textarea id="note-value" rows="8" placeholder="Why are you saving this?">${escapeHtml(bookmark.note)}</textarea><div class="dialog-actions"><button class="secondary" data-cancel>Cancel</button><button class="primary" data-save>Save note</button></div>`);
  $('[data-cancel]', $('#dialog')).addEventListener('click', closeDialog);
  $('[data-save]', $('#dialog')).addEventListener('click', async () => { await request(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: JSON.stringify({ note: $('#note-value').value }) }); closeDialog(); showToast('Personal note saved'); await load(); });
  $('#note-value').focus();
}

function tagDialog(ids, heading) {
  openDialog(`<h2>${escapeHtml(heading)}</h2><p>Type to reuse an existing tag, or deliberately create a new one.</p><label for="tag-value">Tag</label><input id="tag-value" autocomplete="off" placeholder="Start typing…"><div id="suggestions" class="suggestions"></div><div class="dialog-actions"><button class="secondary" data-cancel>Cancel</button></div>`);
  const input = $('#tag-value');
  function renderSuggestions() {
    const query = input.value.trim(); const box = $('#suggestions'); box.innerHTML = '';
    state.tags.filter((tag) => tag.toLowerCase().includes(query.toLowerCase())).forEach((tag) => { const button = menuButton(tag, () => applyTag(ids, tag)); button.innerHTML = `<span>${escapeHtml(tag)}</span><small>existing tag</small>`; box.appendChild(button); });
    if (query && !state.tags.some((tag) => tag.toLowerCase() === query.toLowerCase())) { const create = menuButton('', () => applyTag(ids, query), 'create-tag'); create.innerHTML = `<span>Create “${escapeHtml(query)}”</span><small>new tag</small>`; box.appendChild(create); }
  }
  input.addEventListener('input', renderSuggestions); $('[data-cancel]', $('#dialog')).addEventListener('click', closeDialog); renderSuggestions(); input.focus();
}

async function applyTag(ids, tag) { await request('/api/bulk', { method: 'POST', body: JSON.stringify({ ids, action: 'tag', tag }) }); closeDialog(); showToast(`Added “${tag}” to ${ids.length} bookmark${ids.length === 1 ? '' : 's'}`); await load(); }
async function patchBookmark(id, changes, message) { await request(`/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }); showToast(message); await load(); }
async function retryDetails(bookmark) { try { await request(`/api/bookmarks/${bookmark.id}/retry`, { method: 'POST' }); showToast('Page details updated'); await load(); } catch (error) { showToast(error.message); } }

function deleteDialog(bookmarks, bulk) {
  const count = bookmarks.length; const title = count === 1 ? `Permanently delete this bookmark?` : `Permanently delete ${count} bookmarks?`;
  const named = count === 1 ? `<p>“${escapeHtml(bookmarks[0].title)}”</p>` : '';
  openDialog(`<h2>${title}</h2>${named}<p class="warning">This removes ${count === 1 ? 'its' : 'their'} notes, tags, and saved details. It cannot be undone.</p><div class="dialog-actions"><button class="secondary" data-cancel>Keep bookmark${count === 1 ? '' : 's'}</button><button class="danger" data-confirm>Delete ${count === 1 ? 'permanently' : `${count} permanently`}</button></div>`);
  $('[data-cancel]', $('#dialog')).addEventListener('click', closeDialog);
  $('[data-confirm]', $('#dialog')).addEventListener('click', async () => {
    if (bulk) await request('/api/bulk', { method: 'POST', body: JSON.stringify({ ids: bookmarks.map((item) => item.id), action: 'delete' }) });
    else await request(`/api/bookmarks/${bookmarks[0].id}`, { method: 'DELETE' });
    closeDialog(); showToast(`Permanently deleted ${count} bookmark${count === 1 ? '' : 's'}`); await load();
  });
}

function renderEmpty() {
  const empty = $('#empty-state'); empty.hidden = state.bookmarks.length !== 0; if (empty.hidden) return;
  let title = 'Your first useful bookmark starts here', text = 'Save a link and its page details will appear here.';
  if (state.query) { title = `No results for “${state.query}”`; text = 'No bookmarks match this search. Clear it to return to your saved collection.'; }
  else if (state.view === 'readLater') { title = 'You’re all caught up'; text = 'There’s nothing waiting in Read later. Your bookmarks are still in All bookmarks.'; }
  else if (state.view === 'archive') { title = 'Archive is empty'; text = 'Bookmarks you set aside will stay safe here until you restore them.'; }
  else if (state.tag) { title = `Nothing tagged “${state.tag}”`; text = 'Choose All tags to return to your collection.'; }
  $('#empty-title').textContent = title; $('#empty-text').textContent = text;
}

function updateBulk() {
  const count = state.selected.size; $('#bulk-bar').hidden = count === 0; $('#bulk-count').textContent = `${count} selected`;
  $$('.bookmark-card').forEach((card) => card.classList.toggle('selected', state.selected.has(card.dataset.id)));
}

$('#open-save').addEventListener('click', () => { $('#save-panel').hidden = false; $('#url-input').focus(); });
$('#save-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const input = $('#url-input'); const error = $('#url-error'); error.hidden = true; input.classList.remove('error');
  if (!/^https?:\/\/\S+$/i.test(input.value.trim())) { error.textContent = 'Please enter a complete web address, such as https://example.com'; error.hidden = false; input.classList.add('error'); input.focus(); return; }
  const button = $('#save-form button'); button.disabled = true; button.textContent = 'Gathering details…';
  try {
    const data = await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: input.value.trim() }) });
    input.value = ''; $('#save-panel').hidden = true;
    if (data.duplicate) { state.view = data.bookmark.archived ? 'archive' : 'all'; state.query = ''; state.tag = ''; await load(); setTimeout(() => { const card = $(`[data-id="${data.bookmark.id}"]`); card?.scrollIntoView({ behavior: 'smooth', block: 'center' }); card?.classList.add('selected'); }, 0); showToast('Already saved — showing your existing bookmark'); }
    else { showToast(data.bookmark.enrichment === 'fallback' ? 'Saved, but some page details were unavailable' : 'Bookmark saved with page details'); await load(); }
  } catch (caught) { error.textContent = caught.message; error.hidden = false; input.classList.add('error'); }
  finally { button.disabled = false; button.textContent = 'Save link'; }
});

$$('.nav-item').forEach((button) => button.addEventListener('click', () => { state.view = button.dataset.view; state.tag = ''; state.query = ''; $('#search-input').value = ''; load(); }));
$('.tag-filter[data-tag=""]').addEventListener('click', () => { state.tag = ''; load(); });
let searchTimer; $('#search-input').addEventListener('input', (event) => { clearTimeout(searchTimer); state.query = event.target.value; searchTimer = setTimeout(load, 180); });
$('#sort-select').addEventListener('change', (event) => { state.sort = event.target.value; load(); });
$$('[data-bulk]').forEach((button) => button.addEventListener('click', () => {
  const ids = [...state.selected]; const selected = state.bookmarks.filter((item) => state.selected.has(item.id));
  if (button.dataset.bulk === 'tag') tagDialog(ids, `Tag ${ids.length} bookmarks`);
  if (button.dataset.bulk === 'archive') request('/api/bulk', { method: 'POST', body: JSON.stringify({ ids, action: 'archive' }) }).then(() => { showToast(`Archived ${ids.length} bookmarks · Kept safe`); load(); });
  if (button.dataset.bulk === 'delete') deleteDialog(selected, true);
}));
$('#dialog-layer').addEventListener('click', (event) => { if (event.target === $('#dialog-layer')) closeDialog(); });

load().catch((error) => { $('#empty-state').hidden = false; $('#empty-title').textContent = 'Couldn’t load your bookmarks'; $('#empty-text').textContent = error.message; $('.main').dataset.harnessReady = 'true'; });
