const $ = selector => document.querySelector(selector);
const state = { bookmarks: [], view: 'all', label: '', query: '', preview: null, editing: null, refresh: null, selectedLabels: new Set(), expandedLabels: new Set(), expandedNotes: new Set() };

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const plain = html => { const element = document.createElement('div'); element.innerHTML = html || ''; return element.textContent || ''; };
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body?.error || 'Something went wrong.'); error.status = response.status; error.body = body; throw error; }
  return body;
}
function toast(message) { const node = $('#toast'); node.textContent = message; node.classList.add('show'); setTimeout(() => node.classList.remove('show'), 1800); }
function showBanner(message, action = '') { const node = $('#statusBanner'); node.innerHTML = `<span>${esc(message)}</span>${action}`; node.classList.add('show'); }
function hideBanner() { $('#statusBanner').classList.remove('show'); }

function allLabels() {
  const names = state.bookmarks.flatMap(item => item.labels || []);
  return [...new Map(names.map(name => [name.toLocaleLowerCase(), name])).values()].sort((a, b) => a.localeCompare(b));
}
function visibleBookmarks() {
  let items = state.bookmarks.filter(item => state.view === 'archive' ? item.archived : !item.archived);
  if (state.view === 'later') items = items.filter(item => item.readLater);
  if (state.view === 'label') items = items.filter(item => item.labels.some(label => label.toLocaleLowerCase() === state.label.toLocaleLowerCase()));
  const query = state.query.trim().toLocaleLowerCase();
  if (query) items = items.filter(item => [item.title, item.description, item.url, item.siteName, ...(item.labels || []), plain(item.note)].join(' ').toLocaleLowerCase().includes(query));
  return items;
}
function imageMarkup(item) {
  return item.image ? `<img class="card-image" src="${esc(item.image)}" alt="" onerror="this.outerHTML='<div class=&quot;card-image image-fallback&quot;>↗</div>'">` : '<div class="card-image image-fallback">↗</div>';
}
function labelsMarkup(item) {
  const expanded = state.expandedLabels.has(item.id), visible = expanded ? item.labels : item.labels.slice(0, 3), extra = item.labels.length - visible.length;
  return `<div class="chips">${visible.map(label => `<button class="chip" data-label-link="${esc(label)}">${esc(label)}</button>`).join('')}${item.labels.length > 3 ? `<button class="more-chip" data-expand-labels="${item.id}">${expanded ? 'Show fewer' : `+${extra} more`}</button>` : ''}</div>`;
}
function noteMarkup(item) {
  if (!plain(item.note).trim()) return '';
  const expanded = state.expandedNotes.has(item.id);
  return `<div class="note-preview"><strong>My note</strong><div class="note-body ${expanded ? '' : 'collapsed'}">${item.note}</div>${plain(item.note).length > 120 ? `<button class="text-action" data-expand-note="${item.id}">${expanded ? 'Show less' : 'Show full note'}</button>` : ''}</div>`;
}
function cardMarkup(item) {
  return `<article class="bookmark-card" id="bookmark-${item.id}" data-id="${item.id}" data-open="${item.id}">
    ${imageMarkup(item)}
    <div class="card-main" data-open="${item.id}" tabindex="0" role="link" aria-label="Open ${esc(item.title)} in a new tab">
      <div class="site-line">${item.icon ? `<img src="${esc(item.icon)}" alt="" onerror="this.remove()">` : ''}<span>${esc(item.siteName || new URL(item.url).hostname)}</span></div>
      <div class="card-title">${esc(item.title)}</div><p class="card-description">${esc(item.description)}</p><div class="open-cue">Open original ↗</div>
      ${labelsMarkup(item)}${noteMarkup(item)}
    </div>
    <div class="card-actions"><button class="icon-button later-button ${item.readLater ? 'active' : ''}" data-later="${item.id}" aria-label="${item.readLater ? 'Mark as read' : 'Save for later'}" aria-pressed="${item.readLater}">▣</button><button class="icon-button" data-menu="${item.id}" aria-label="More actions">•••</button></div>
    <div class="action-menu" data-menu-panel="${item.id}" hidden><button data-edit="${item.id}">Edit details</button><button data-refresh="${item.id}">Refresh from page</button><button data-archive="${item.id}">${item.archived ? 'Restore to All bookmarks' : 'Archive'}</button><button class="menu-danger" data-delete="${item.id}">Delete</button></div>
  </article>`;
}

function render() {
  const labels = allLabels();
  $('#allCount').textContent = state.bookmarks.filter(x => !x.archived).length || '';
  $('#laterCount').textContent = state.bookmarks.filter(x => !x.archived && x.readLater).length || '';
  $('#archiveCount').textContent = state.bookmarks.filter(x => x.archived).length || '';
  $('#labelNav').innerHTML = labels.map(label => `<button class="nav-item ${state.view === 'label' && state.label === label ? 'active' : ''}" data-label-nav="${esc(label)}"><span>${esc(label)}</span><span>${state.bookmarks.filter(x => !x.archived && x.labels.includes(label)).length}</span></button>`).join('');
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
  const titles = { all: ['Your library', 'All bookmarks'], later: ['Reading queue', 'Read later'], archive: ['Tucked away', 'Archive'], label: ['Label', state.label] };
  const [eyebrow, title] = titles[state.view]; $('#eyebrow').textContent = eyebrow; $('#viewTitle').textContent = state.query ? `Search results for “${state.query}”` : title;
  const items = visibleBookmarks(); $('#resultCount').textContent = `${items.length} ${items.length === 1 ? 'bookmark' : 'bookmarks'}`; $('#bookmarkList').innerHTML = items.map(cardMarkup).join('');
  const empty = $('#emptyState'); empty.hidden = items.length > 0;
  if (!items.length) {
    if (state.query) { $('#emptyTitle').textContent = 'No bookmarks match that search'; $('#emptyText').textContent = 'Try changing or clearing your search. Your saved bookmarks are untouched.'; $('#emptyAdd').hidden = true; }
    else if (state.view === 'later') { $('#emptyTitle').textContent = 'You’re all caught up'; $('#emptyText').textContent = 'Bookmarks you save for later will appear here.'; $('#emptyAdd').hidden = true; }
    else if (state.view === 'archive') { $('#emptyTitle').textContent = 'Archive is empty'; $('#emptyText').textContent = 'Bookmarks you tuck away will stay safely here.'; $('#emptyAdd').hidden = true; }
    else { $('#emptyTitle').textContent = 'Nothing saved yet'; $('#emptyText').textContent = 'Add your first useful link to begin.'; $('#emptyAdd').hidden = false; }
  }
}
async function load() { const data = await api('/api/bookmarks'); state.bookmarks = data.bookmarks; render(); }

function openAdd() { $('#addForm').reset(); $('#urlError').textContent = ''; $('#addDialog').showModal(); setTimeout(() => $('#urlInput').focus(), 0); }
$('#addButton').onclick = openAdd; $('#emptyAdd').onclick = openAdd;
$('#addForm').onsubmit = async event => {
  event.preventDefault(); $('#urlError').textContent = ''; $('#fetchButton').disabled = true; $('#fetchButton').textContent = 'Collecting…';
  try {
    state.preview = await api('/api/preview', { method: 'POST', body: JSON.stringify({ url: $('#urlInput').value }) });
    $('#addDialog').close(); showReview(state.preview);
  } catch (error) {
    if (error.status === 409 && error.body.duplicate) { $('#addDialog').close(); state.view = error.body.duplicate.archived ? 'archive' : 'all'; state.query = ''; $('#search').value = ''; render(); showBanner('You already saved this link.', `<button class="text-action" data-edit="${error.body.duplicate.id}">Edit it</button>`); setTimeout(() => { const card = $(`#bookmark-${error.body.duplicate.id}`); card?.scrollIntoView({ behavior: 'smooth', block: 'center' }); card?.classList.add('focused'); setTimeout(() => card?.classList.remove('focused'), 2500); }, 50); }
    else $('#urlError').textContent = error.message;
  } finally { $('#fetchButton').disabled = false; $('#fetchButton').textContent = 'Collect details'; }
};
function showReview(preview) {
  $('#reviewHeading').textContent = preview.fetched ? 'Here’s what we found' : 'Add this link manually'; $('#fetchWarning').hidden = preview.fetched;
  $('#reviewTitle').value = preview.title || ''; $('#reviewDescription').value = preview.description || ''; $('#reviewSite').textContent = preview.siteName; $('#reviewUrl').textContent = preview.url;
  $('#reviewIcon').src = preview.icon || ''; $('#reviewIcon').hidden = !preview.icon; $('#reviewImage').innerHTML = preview.image ? `<img src="${esc(preview.image)}" alt="">` : '<span>No picture available</span>'; $('#reviewError').textContent = ''; $('#reviewDialog').showModal();
}
$('#reviewForm').onsubmit = async event => {
  event.preventDefault(); $('#reviewError').textContent = '';
  try { const item = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ ...state.preview, title: $('#reviewTitle').value, description: $('#reviewDescription').value, labels: [], note: '' }) }); state.bookmarks.unshift(item); $('#reviewDialog').close(); state.view = 'all'; render(); toast('Bookmark saved'); }
  catch (error) { $('#reviewError').textContent = error.message; }
};

function openEditor(id) {
  const item = state.bookmarks.find(x => x.id === id); if (!item) return; state.editing = id; state.selectedLabels = new Set(item.labels);
  $('#editTitle').value = item.title; $('#editDescription').value = item.description; $('#noteEditor').innerHTML = item.note || ''; $('#labelSearch').value = ''; $('#editError').textContent = ''; renderLabelChoices(); $('#editDialog').showModal();
}
function renderLabelChoices() {
  const query = $('#labelSearch').value.trim(), labels = allLabels(), filtered = labels.filter(label => label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  $('#labelChoices').innerHTML = filtered.map(label => `<label class="label-choice"><input type="checkbox" value="${esc(label)}" ${state.selectedLabels.has(label) ? 'checked' : ''}> <span>${esc(label)}</span></label>`).join('') || `<div class="label-choice">No existing labels match.</div>`;
  const create = $('#createLabel'); const exact = labels.some(label => label.toLocaleLowerCase() === query.toLocaleLowerCase()); create.hidden = !query || filtered.length > 0 || exact; create.textContent = query ? `+ Create “${query}”` : '';
}
$('#labelSearch').oninput = renderLabelChoices;
$('#labelChoices').onchange = event => { const name = event.target.value; event.target.checked ? state.selectedLabels.add(name) : state.selectedLabels.delete(name); };
$('#createLabel').onclick = () => { const value = $('#labelSearch').value.trim(); if (!value) return; const existing = allLabels().find(label => label.toLocaleLowerCase() === value.toLocaleLowerCase()); state.selectedLabels.add(existing || value); $('#labelSearch').value = ''; renderLabelChoices(); };
document.querySelectorAll('[data-command]').forEach(button => button.onclick = () => { const command = button.dataset.command; if (command === 'createLink') { const href = prompt('Web address', 'https://'); if (href) document.execCommand(command, false, href); } else document.execCommand(command); $('#noteEditor').focus(); });
$('#editForm').onsubmit = async event => { event.preventDefault(); try { const item = await api(`/api/bookmarks/${state.editing}`, { method: 'PATCH', body: JSON.stringify({ title: $('#editTitle').value, description: $('#editDescription').value, note: $('#noteEditor').innerHTML, labels: [...state.selectedLabels] }) }); state.bookmarks = state.bookmarks.map(x => x.id === item.id ? item : x); $('#editDialog').close(); render(); toast('Changes saved'); } catch (error) { $('#editError').textContent = error.message; } };

async function patchItem(id, changes, message) { const item = await api(`/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }); state.bookmarks = state.bookmarks.map(x => x.id === id ? item : x); render(); if (message) toast(message); }
async function openRefresh(id) {
  const item = state.bookmarks.find(x => x.id === id); state.refresh = { id, current: item, newer: null }; $('#refreshError').textContent = ''; $('#refreshGrid').innerHTML = '<div class="refresh-panel">Collecting newer details…</div>'; $('#refreshDialog').showModal();
  try { const newer = await api(`/api/bookmarks/${id}/refresh`, { method: 'POST' }); state.refresh.newer = newer; $('#refreshGrid').innerHTML = `<section class="refresh-panel"><h3>Your saved bookmark</h3><div class="refresh-row"><strong>${esc(item.title)}</strong></div><div class="refresh-row">${esc(item.description)}</div>${item.image ? `<img class="refresh-image" src="${esc(item.image)}" alt="">` : ''}</section><section class="refresh-panel"><h3>New from the page</h3><div class="refresh-row"><label><input type="checkbox" name="title"> Use new title</label><p>${esc(newer.title || 'No title found')}</p></div><div class="refresh-row"><label><input type="checkbox" name="description"> Use new description</label><p>${esc(newer.description || 'No description found')}</p></div><div class="refresh-row"><label><input type="checkbox" name="icon"> Use new icon</label></div><div class="refresh-row"><label><input type="checkbox" name="image"> Use new picture</label>${newer.image ? `<img class="refresh-image" src="${esc(newer.image)}" alt="">` : '<p>No picture found</p>'}</div></section>`; }
  catch (error) { $('#refreshError').textContent = error.message; $('#refreshGrid').innerHTML = ''; }
}
$('#refreshForm').onsubmit = async event => { event.preventDefault(); if (!state.refresh?.newer) return; const changes = {}; new FormData(event.target).forEach((_value, key) => changes[key] = state.refresh.newer[key]); if (!Object.keys(changes).length) { $('#refreshDialog').close(); return; } await patchItem(state.refresh.id, changes, 'Selected details updated'); $('#refreshDialog').close(); };

function openDelete(id) { state.editing = id; const item = state.bookmarks.find(x => x.id === id); $('#deleteMessage').textContent = `This removes “${item.title}” from your collection. This can’t be undone.`; $('#deleteDialog').showModal(); }
$('#deleteForm').onsubmit = async event => { event.preventDefault(); await api(`/api/bookmarks/${state.editing}`, { method: 'DELETE' }); state.bookmarks = state.bookmarks.filter(x => x.id !== state.editing); $('#deleteDialog').close(); render(); toast('Bookmark deleted'); };

document.addEventListener('click', async event => {
  const labelNav = event.target.closest('[data-label-nav]'); if (labelNav) { state.view = 'label'; state.label = labelNav.dataset.labelNav; state.query = ''; $('#search').value = ''; hideBanner(); render(); return; }
  const nav = event.target.closest('[data-view]'); if (nav) { state.view = nav.dataset.view; state.label = ''; state.query = ''; $('#search').value = ''; hideBanner(); render(); return; }
  const labelLink = event.target.closest('[data-label-link]'); if (labelLink) { state.view = 'label'; state.label = labelLink.dataset.labelLink; render(); return; }
  const expandLabels = event.target.closest('[data-expand-labels]'); if (expandLabels) { const id = expandLabels.dataset.expandLabels; state.expandedLabels.has(id) ? state.expandedLabels.delete(id) : state.expandedLabels.add(id); render(); return; }
  const expandNote = event.target.closest('[data-expand-note]'); if (expandNote) { const id = expandNote.dataset.expandNote; state.expandedNotes.has(id) ? state.expandedNotes.delete(id) : state.expandedNotes.add(id); render(); return; }
  const menuButton = event.target.closest('[data-menu]'); if (menuButton) { const panel = document.querySelector(`[data-menu-panel="${menuButton.dataset.menu}"]`); document.querySelectorAll('.action-menu').forEach(x => { if (x !== panel) x.hidden = true; }); panel.hidden = !panel.hidden; return; }
  const edit = event.target.closest('[data-edit]'); if (edit) { openEditor(edit.dataset.edit); return; }
  const later = event.target.closest('[data-later]'); if (later) { const item = state.bookmarks.find(x => x.id === later.dataset.later); await patchItem(item.id, { readLater: !item.readLater }, item.readLater ? 'Marked as read' : 'Saved for later'); return; }
  const archive = event.target.closest('[data-archive]'); if (archive) { const item = state.bookmarks.find(x => x.id === archive.dataset.archive); await patchItem(item.id, { archived: !item.archived }, item.archived ? 'Restored to All bookmarks' : 'Moved to Archive'); return; }
  const remove = event.target.closest('[data-delete]'); if (remove) { openDelete(remove.dataset.delete); return; }
  const refresh = event.target.closest('[data-refresh]'); if (refresh) { openRefresh(refresh.dataset.refresh); return; }
  const opener = event.target.closest('[data-open]'); if (opener && !event.target.closest('button,a')) { const item = state.bookmarks.find(x => x.id === opener.dataset.open); window.open(item.url, '_blank', 'noopener'); }
});
document.addEventListener('keydown', event => { const opener = event.target.closest?.('[data-open]'); if (opener && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); const item = state.bookmarks.find(x => x.id === opener.dataset.open); window.open(item.url, '_blank', 'noopener'); } });
$('#search').oninput = event => { state.query = event.target.value; hideBanner(); render(); };

load().catch(error => { $('#emptyState').hidden = false; $('#emptyTitle').textContent = 'Couldn’t load your bookmarks'; $('#emptyText').textContent = error.message; });
