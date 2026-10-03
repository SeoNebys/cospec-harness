const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

let appState = { bookmarks: [], savedSearches: [], settings: { pageSize: 25, textSize: 'comfortable', defaultSort: 'newest' } };
let view = 'all';
let sort = 'newest';
let page = 1;
let selectionMode = false;
let selected = new Set();
let selectedLabels = new Set();
let activeSavedSearch = null;
let labelTargets = [];
let importToken = null;

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : await response.blob();
  if (!response.ok) throw new Error(payload.error || 'Something went wrong');
  return payload;
}

function escapeHtml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function toast(message) {
  const node = $('#toast'); node.textContent = message; node.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('show'), 3000);
}

function allLabels() {
  const counts = new Map();
  appState.bookmarks.forEach(bookmark => bookmark.labels.forEach(label => counts.set(label, (counts.get(label) || 0) + 1)));
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function currentFilters() {
  return { text: $('#searchInput').value.trim(), exact: $('#exactInput').value.trim(), excludeSite: $('#excludeInput').value.trim(), labels: [...selectedLabels], labelMode: $('#labelMode').value };
}

function normalizedText(bookmark) { return `${bookmark.title} ${bookmark.description} ${bookmark.url}`.toLocaleLowerCase(); }

function matchingBookmarks() {
  const filters = currentFilters();
  let values = appState.bookmarks.filter(bookmark => view === 'put-away' ? bookmark.putAway : !bookmark.putAway && (view !== 'read-later' || bookmark.readLater));
  if (filters.text) values = values.filter(bookmark => filters.text.toLocaleLowerCase().split(/\s+/).every(term => normalizedText(bookmark).includes(term)));
  if (filters.exact) values = values.filter(bookmark => normalizedText(bookmark).includes(filters.exact.toLocaleLowerCase()));
  if (filters.excludeSite) values = values.filter(bookmark => !bookmark.source.toLocaleLowerCase().includes(filters.excludeSite.toLocaleLowerCase()));
  if (filters.labels.length) values = values.filter(bookmark => {
    const owned = bookmark.labels.map(label => label.toLocaleLowerCase());
    return filters.labelMode === 'all' ? filters.labels.every(label => owned.includes(label.toLocaleLowerCase())) : filters.labels.some(label => owned.includes(label.toLocaleLowerCase()));
  });
  return values.sort((a, b) => {
    if (sort === 'name') return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    if (a.dateKnown !== b.dateKnown) return a.dateKnown ? -1 : 1;
    if (!a.dateKnown) return a.title.localeCompare(b.title);
    const difference = new Date(a.createdAt) - new Date(b.createdAt);
    return sort === 'oldest' ? difference : -difference;
  });
}

function dateLabel(bookmark) {
  if (!bookmark.dateKnown) return 'Date unavailable';
  return `Saved ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(bookmark.createdAt))}`;
}

function card(bookmark) {
  const captureReady = bookmark.capture?.status === 'ready';
  const pdf = captureReady && bookmark.capture.type === 'pdf';
  const selectedAttr = selected.has(bookmark.id) ? 'checked' : '';
  const icon = bookmark.favicon ? `<img src="${escapeHtml(bookmark.favicon)}" alt="" loading="lazy" onerror="this.parentElement.textContent='${escapeHtml(bookmark.source[0]?.toUpperCase() || 'K')}'">` : escapeHtml(bookmark.source[0]?.toUpperCase() || 'K');
  const chips = bookmark.labels.map(label => `<button class="chip" data-filter-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`).join('');
  return `<article class="bookmark-card" id="bookmark-${bookmark.id}" data-id="${bookmark.id}">
    ${selectionMode ? `<label class="card-select" aria-label="Select ${escapeHtml(bookmark.title)}"><input type="checkbox" data-select="${bookmark.id}" ${selectedAttr}></label>` : `<div class="site-icon">${icon}</div>`}
    <div class="card-main">
      <div class="card-title-row"><a class="card-title" href="${escapeHtml(bookmark.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(bookmark.title)}</a>${pdf ? '<span class="type-badge">PDF</span>' : ''}${bookmark.detailsStatus === 'needs-retry' ? '<span class="status-badge">Needs retry</span>' : ''}</div>
      <div class="card-meta">${escapeHtml(bookmark.source)} · ${dateLabel(bookmark)}${bookmark.readLater ? ' · Read later' : ''}${bookmark.putAway ? ' · Put away' : ''}</div>
      ${bookmark.description ? `<p class="card-description">${escapeHtml(bookmark.description)}</p><button class="expand-button" data-expand hidden>Show full details</button>` : '<p class="card-description">No description yet. You can add one in Edit details.</p>'}
      <div class="chips">${chips}<button class="chip add-label" data-add-label="${bookmark.id}">+ Label</button></div>
    </div>
    <div class="card-actions">
      ${view === 'read-later' ? `<button class="card-action" data-read="${bookmark.id}">Mark as read</button>` : !bookmark.readLater ? `<button class="card-action" data-unread="${bookmark.id}">Set aside to read</button>` : ''}
      ${view === 'put-away' ? `<button class="card-action" data-restore="${bookmark.id}">Restore to library</button>` : ''}
      <details class="more-menu"><summary aria-label="More actions">•••</summary><div>
        ${captureReady ? `<a href="/saved/${pdf ? 'pdf' : 'page'}/${bookmark.id}" target="_blank">${pdf ? 'Open saved PDF' : 'View saved copy'}</a>` : `<button data-retry="${bookmark.id}">Retry gathering details</button>`}
        ${pdf ? `<a href="/saved/pdf/${bookmark.id}?download">Download saved PDF</a>` : ''}
        <button data-edit="${bookmark.id}">Edit details</button>
        ${view !== 'put-away' ? `<button data-away="${bookmark.id}">Put away</button>` : ''}
        <button class="delete-action" data-delete="${bookmark.id}">Delete</button>
      </div></details>
    </div>
  </article>`;
}

function renderLabels() {
  const labels = allLabels();
  $('#filterLabels').innerHTML = labels.length ? labels.map(([label, count]) => `<label class="filter-label"><input type="checkbox" value="${escapeHtml(label)}" ${selectedLabels.has(label) ? 'checked' : ''}><span>${escapeHtml(label)} · ${count}</span></label>`).join('') : '<span class="card-meta">No labels yet</span>';
  $('#labelSuggestions').innerHTML = labels.map(([label, count]) => `<option value="${escapeHtml(label)}">Used on ${count} bookmark${count === 1 ? '' : 's'}</option>`).join('');
}

function renderSavedSearches() {
  $('#savedSearches').innerHTML = appState.savedSearches.length ? appState.savedSearches.map(search => `<div class="saved-search"><button class="nav-item ${activeSavedSearch === search.id ? 'active' : ''}" data-saved-search="${search.id}">${escapeHtml(search.name)}</button><button class="icon-button" data-delete-search="${search.id}" title="Delete saved search">×</button></div>`).join('') : '<p class="card-meta" style="padding:0 8px">None yet</p>';
}

function render() {
  document.body.classList.remove('text-compact', 'text-large');
  if (appState.settings.textSize !== 'comfortable') document.body.classList.add(`text-${appState.settings.textSize}`);
  const headings = { all: ['Your bookmarks', 'A calm place for everything worth keeping.'], 'read-later': ['Read later', 'Your short list of things still waiting.'], 'put-away': ['Put away', 'Out of the way, still safely kept.'] };
  [$('#viewTitle').textContent, $('#viewNote').textContent] = headings[view];
  $$('.nav-item[data-view]').forEach(node => node.classList.toggle('active', node.dataset.view === view));
  $('#saveForm').hidden = view === 'put-away';
  $('#allCount').textContent = appState.bookmarks.filter(item => !item.putAway).length;
  $('#readCount').textContent = appState.bookmarks.filter(item => !item.putAway && item.readLater).length;
  $('#awayCount').textContent = appState.bookmarks.filter(item => item.putAway).length;
  renderLabels(); renderSavedSearches();
  const results = matchingBookmarks();
  const pageSize = appState.settings.pageSize;
  const pages = Math.max(1, Math.ceil(results.length / pageSize));
  if (page > pages) page = pages;
  const shown = results.slice((page - 1) * pageSize, page * pageSize);
  $('#resultCount').textContent = `${results.length} bookmark${results.length === 1 ? '' : 's'} · ${pageSize} per page`;
  $('#activeSearchName').textContent = activeSavedSearch ? `· ${appState.savedSearches.find(item => item.id === activeSavedSearch)?.name || ''}` : '';
  if (!shown.length) {
    const searching = $('#searchInput').value || $('#exactInput').value || $('#excludeInput').value || selectedLabels.size;
    const message = view === 'read-later' && !searching ? ['All caught up', 'There is nothing left in Read later.'] : view === 'put-away' && !searching ? ['Nothing put away', 'Bookmarks you tuck away will stay safe here.'] : searching ? ['Nothing matches right now', activeSavedSearch ? 'This saved search is still here. Adjust its conditions, or check back when your library grows.' : 'Try changing or clearing one of your search conditions.'] : ['Your shelf is ready', 'Paste a web address above to save your first bookmark.'];
    $('#bookmarkList').innerHTML = `<div class="empty-state"><strong>${message[0]}</strong>${message[1]}</div>`;
  } else $('#bookmarkList').innerHTML = shown.map(card).join('');
  $('#pagination').innerHTML = pages > 1 ? Array.from({ length: pages }, (_, index) => `<button data-page="${index + 1}" class="${page === index + 1 ? 'active' : ''}">${index + 1}</button>`).join('') : '';
  $('#bulkBar').hidden = !selectionMode;
  $('#selectionToggle').textContent = selectionMode ? 'Done selecting' : 'Select bookmarks';
  $('#selectedCount').textContent = `${selected.size} selected`;
  $('#selectAllText').textContent = `Select all ${results.length} result${results.length === 1 ? '' : 's'}`;
  $('#selectAll').checked = results.length > 0 && results.every(item => selected.has(item.id));
  $('#bulkAway').textContent = view === 'put-away' ? 'Restore' : 'Put away';
  requestAnimationFrame(() => $$('.card-description').forEach(node => { const button = node.nextElementSibling; if (button?.matches('[data-expand]') && node.scrollHeight > node.clientHeight + 2) button.hidden = false; }));
}

async function refresh() { appState = await api('/api/state'); render(); }

function setFilters(filters = {}) {
  $('#searchInput').value = filters.text || '';
  $('#exactInput').value = filters.exact || '';
  $('#excludeInput').value = filters.excludeSite || '';
  $('#labelMode').value = filters.labelMode || 'any';
  selectedLabels = new Set(filters.labels || []);
  page = 1; render();
}

function clearSelection() { selected.clear(); selectionMode = false; render(); }

async function patchBookmark(id, changes, message) {
  try { await api(`/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }); await refresh(); if (message) toast(message); }
  catch (error) { toast(error.message); }
}

function confirmDelete(bookmarks) {
  const dialog = $('#confirmDialog');
  $('#confirmTitle').textContent = bookmarks.length === 1 ? 'Delete this bookmark?' : `Delete ${bookmarks.length} bookmarks?`;
  $('#confirmText').textContent = 'This cannot be undone. You are about to permanently remove:';
  $('#confirmNames').innerHTML = bookmarks.map(item => `<li>${escapeHtml(item.title)}</li>`).join('');
  dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}

async function bulk(action, value) {
  if (!selected.size) return toast('Select at least one bookmark');
  await api('/api/bulk', { method: 'POST', body: JSON.stringify({ ids: [...selected], action, value }) });
  selected.clear(); selectionMode = false; await refresh(); toast('Selected bookmarks updated');
}

$('#saveForm').addEventListener('submit', async event => {
  event.preventDefault(); $('#saveError').textContent = '';
  const button = event.submitter; button.disabled = true; button.textContent = 'Saving…';
  try {
    const result = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: $('#urlInput').value, readLater: $('#saveReadLater').checked }) });
    $('#urlInput').value = ''; $('#saveReadLater').checked = false; await refresh();
    if (result.duplicate) { view = result.bookmark.putAway ? 'put-away' : 'all'; render(); toast('Already saved — here is your bookmark'); }
    else toast(result.bookmark.detailsStatus === 'needs-retry' ? 'Link saved. Details need another try.' : 'Bookmark saved with a preserved copy');
    setTimeout(() => { const node = $(`#bookmark-${result.bookmark.id}`); node?.classList.add('highlight'); node?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 40);
  } catch (error) { $('#saveError').textContent = error.message; }
  finally { button.disabled = false; button.textContent = 'Save bookmark'; }
});

$('#searchInput').addEventListener('input', () => { activeSavedSearch = null; page = 1; render(); });
$('#exactInput').addEventListener('input', () => { activeSavedSearch = null; page = 1; render(); });
$('#excludeInput').addEventListener('input', () => { activeSavedSearch = null; page = 1; render(); });
$('#labelMode').addEventListener('change', () => { activeSavedSearch = null; render(); });
$('#filterLabels').addEventListener('change', event => { if (!event.target.matches('input')) return; event.target.checked ? selectedLabels.add(event.target.value) : selectedLabels.delete(event.target.value); activeSavedSearch = null; page = 1; render(); });
$('#filtersButton').addEventListener('click', () => { const hidden = !$('#filters').hidden; $('#filters').hidden = hidden; $('#filtersButton').setAttribute('aria-expanded', String(!hidden)); });
$('#clearFilters').addEventListener('click', () => { activeSavedSearch = null; setFilters(); });

$$('[data-view]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); view = button.dataset.view; activeSavedSearch = null; selectionMode = false; selected.clear(); page = 1; render(); }));
$('#sortSelect').addEventListener('change', event => { sort = event.target.value; page = 1; render(); });
$('#selectionToggle').addEventListener('click', () => { selectionMode = !selectionMode; selected.clear(); render(); });
$('#selectAll').addEventListener('change', event => { if (event.target.checked) matchingBookmarks().forEach(item => selected.add(item.id)); else matchingBookmarks().forEach(item => selected.delete(item.id)); render(); });

$('#bookmarkList').addEventListener('change', event => { if (event.target.matches('[data-select]')) { event.target.checked ? selected.add(event.target.dataset.select) : selected.delete(event.target.dataset.select); render(); } });
$('#bookmarkList').addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.filterLabel) { selectedLabels = new Set([button.dataset.filterLabel]); $('#filters').hidden = false; $('#filtersButton').setAttribute('aria-expanded', 'true'); view = 'all'; page = 1; render(); return; }
  if (button.dataset.expand !== undefined) { const copy = button.previousElementSibling; copy.classList.toggle('expanded'); button.textContent = copy.classList.contains('expanded') ? 'Show less' : 'Show full details'; return; }
  const id = button.dataset.edit || button.dataset.delete || button.dataset.read || button.dataset.unread || button.dataset.away || button.dataset.restore || button.dataset.retry || button.dataset.addLabel;
  if (!id) return;
  const bookmark = appState.bookmarks.find(item => item.id === id);
  button.closest('details')?.removeAttribute('open');
  if (button.dataset.edit) { $('#editId').value = id; $('#editTitle').value = bookmark.title; $('#editDescription').value = bookmark.description; $('#editUrl').value = bookmark.url; $('#editError').textContent = ''; $('#editDialog').showModal(); }
  if (button.dataset.delete) { if (await confirmDelete([bookmark])) { await api(`/api/bookmarks/${id}`, { method: 'DELETE' }); await refresh(); toast('Bookmark permanently deleted'); } }
  if (button.dataset.read) await patchBookmark(id, { readLater: false }, 'Marked as read');
  if (button.dataset.unread) await patchBookmark(id, { readLater: true }, 'Added to Read later');
  if (button.dataset.away) await patchBookmark(id, { putAway: true }, 'Bookmark put away');
  if (button.dataset.restore) await patchBookmark(id, { putAway: false }, 'Restored to your library');
  if (button.dataset.retry) { button.disabled = true; try { await api(`/api/bookmarks/${id}/retry`, { method: 'POST' }); await refresh(); toast('Details and saved copy gathered'); } catch (error) { toast(error.message); button.disabled = false; } }
  if (button.dataset.addLabel) { labelTargets = [id]; $('#labelDialog input[value="add"]').checked = true; $('#bulkLabelInput').value = ''; $('#labelDialog').showModal(); }
});

$('#editSubmit').addEventListener('click', async event => {
  event.preventDefault(); $('#editError').textContent = '';
  try { await api(`/api/bookmarks/${$('#editId').value}`, { method: 'PATCH', body: JSON.stringify({ title: $('#editTitle').value, description: $('#editDescription').value, url: $('#editUrl').value }) }); $('#editDialog').close(); await refresh(); toast('Bookmark details updated'); }
  catch (error) { $('#editError').textContent = error.message; }
});

$('#bulkLabels').addEventListener('click', () => { if (!selected.size) return toast('Select at least one bookmark'); labelTargets = [...selected]; $('#bulkLabelInput').value = ''; $('#labelDialog').showModal(); });
$('#labelDialog').addEventListener('close', async () => {
  if ($('#labelDialog').returnValue !== 'apply') return;
  const value = $('#bulkLabelInput').value.trim(); if (!value) return toast('Enter or choose a label');
  const action = $(`input[name="labelDirection"]:checked`).value === 'remove' ? 'remove-label' : 'add-label';
  await api('/api/bulk', { method: 'POST', body: JSON.stringify({ ids: labelTargets, action, value }) });
  selected.clear(); selectionMode = false; await refresh(); toast(action === 'remove-label' ? `Removed “${value}”` : `Added “${value}”`);
});
$('#bulkReading').addEventListener('click', () => { if (!selected.size) return toast('Select at least one bookmark'); $('#readingDialog').showModal(); });
$('#readingDialog').addEventListener('close', async () => { if (['read', 'unread'].includes($('#readingDialog').returnValue)) await bulk($('#readingDialog').returnValue); });
$('#bulkAway').addEventListener('click', () => bulk(view === 'put-away' ? 'restore' : 'put-away'));
$('#bulkDelete').addEventListener('click', async () => { const bookmarks = appState.bookmarks.filter(item => selected.has(item.id)); if (!bookmarks.length) return toast('Select at least one bookmark'); if (await confirmDelete(bookmarks)) await bulk('delete'); });

$('#pagination').addEventListener('click', event => { const button = event.target.closest('[data-page]'); if (button) { page = Number(button.dataset.page); render(); scrollTo({ top: $('#bookmarkList').offsetTop - 30, behavior: 'smooth' }); } });

function openSaveSearch() { $('#savedSearchName').value = ''; $('#saveSearchDialog').showModal(); }
$('#saveSearch').addEventListener('click', openSaveSearch); $('#saveSearchSide').addEventListener('click', openSaveSearch);
$('#saveSearchDialog').addEventListener('close', async () => { if ($('#saveSearchDialog').returnValue !== 'save') return; const name = $('#savedSearchName').value.trim(); if (!name) return; const result = await api('/api/saved-searches', { method: 'POST', body: JSON.stringify({ name, filters: currentFilters() }) }); activeSavedSearch = result.saved.id; await refresh(); toast('Search saved to the sidebar'); });
$('#savedSearches').addEventListener('click', async event => {
  const open = event.target.closest('[data-saved-search]'); const remove = event.target.closest('[data-delete-search]');
  if (open) { const saved = appState.savedSearches.find(item => item.id === open.dataset.savedSearch); activeSavedSearch = saved.id; view = 'all'; $('#filters').hidden = false; $('#filtersButton').setAttribute('aria-expanded', 'true'); setFilters(saved.filters); activeSavedSearch = saved.id; render(); }
  if (remove) { await api(`/api/saved-searches/${remove.dataset.deleteSearch}`, { method: 'DELETE' }); if (activeSavedSearch === remove.dataset.deleteSearch) activeSavedSearch = null; await refresh(); }
});

$('#importButton').addEventListener('click', () => { importToken = null; $('#importChoose').hidden = false; $('#importPreview').hidden = true; $('#importCommit').hidden = true; $('#importError').textContent = ''; $('#importFile').value = ''; $('#importDialog').showModal(); });
$('#importFile').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return; $('#importError').textContent = '';
  try {
    const result = await api('/api/import/preview', { method: 'POST', body: JSON.stringify({ name: file.name, content: await file.text() }) }); importToken = result.token;
    $('#importChoose').hidden = true; $('#importPreview').hidden = false; $('#importCommit').hidden = false;
    $('#importPreview').innerHTML = `<div class="import-summary"><strong>${result.total}</strong> bookmarks found<p>${result.newCount} new · ${result.duplicates} already saved · ${result.dated} with saved dates</p><p>${result.folders.length} folder${result.folders.length === 1 ? '' : 's'} will become labels</p><div class="import-folders">${result.folders.map(label => `<span class="chip">${escapeHtml(label)}</span>`).join('')}</div></div><p>Existing titles and descriptions will stay untouched. New folder labels will be added to matching bookmarks.</p>`;
  } catch (error) { $('#importError').textContent = error.message; $('#importFile').value = ''; }
});
$('#importCommit').addEventListener('click', async () => { try { const result = await api('/api/import/commit', { method: 'POST', body: JSON.stringify({ token: importToken }) }); $('#importDialog').close(); await refresh(); toast(`Imported ${result.added} new; updated labels on ${result.merged}`); } catch (error) { $('#importError').textContent = error.message; } });

async function download(url, fallbackName) {
  const response = await fetch(url); if (!response.ok) { const value = await response.json(); throw new Error(value.error || 'Download failed'); }
  const blob = await response.blob(); const disposition = response.headers.get('content-disposition') || ''; const name = disposition.match(/filename="?([^";]+)"?/)?.[1] || fallbackName;
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}
$('#exportButton').addEventListener('click', () => { $('#exportError').textContent = ''; $('#exportDialog').showModal(); });
$('#fullBackup').addEventListener('click', async event => { event.target.disabled = true; $('#exportError').textContent = ''; try { await download('/api/export/full', 'kept-backup.json'); toast('Full backup downloaded'); } catch (error) { $('#exportError').textContent = `${error.message} Your library is untouched and safe.`; event.target.textContent = 'Retry full backup'; } finally { event.target.disabled = false; } });
$('#browserExport').addEventListener('click', async () => { try { await download('/api/export/browser', 'kept-bookmarks.html'); toast('Portable browser file downloaded'); } catch (error) { $('#exportError').textContent = error.message; } });

$('#settingsButton').addEventListener('click', () => { $('#settingPageSize').value = appState.settings.pageSize; $('#settingTextSize').value = appState.settings.textSize; $('#settingSort').value = appState.settings.defaultSort; $('#settingsDialog').showModal(); });
$('#settingsDialog').addEventListener('close', async () => { if ($('#settingsDialog').returnValue !== 'save') return; const settings = await api('/api/settings', { method: 'PATCH', body: JSON.stringify({ pageSize: Number($('#settingPageSize').value), textSize: $('#settingTextSize').value, defaultSort: $('#settingSort').value }) }); appState.settings = settings.settings; sort = settings.settings.defaultSort; $('#sortSelect').value = sort; page = 1; render(); toast('Comfort settings saved'); });

sort = appState.settings.defaultSort;
try { await refresh(); sort = appState.settings.defaultSort; $('#sortSelect').value = sort; render(); $('#app').setAttribute('data-harness-ready', 'true'); }
catch (error) { $('#bookmarkList').innerHTML = `<div class="empty-state"><strong>Kept could not start</strong>${escapeHtml(error.message)}</div>`; }
