const $ = selector => document.querySelector(selector);
const state = {
  bookmarks: [],
  tags: [],
  view: 'all',
  activeTag: null,
  search: '',
  preview: null,
  editingId: null,
  editTags: [],
  noticeTimer: null,
  previewTimer: null,
  previewRequest: 0,
  availabilityRefresh: null
};

const elements = {
  app: $('#app'),
  url: $('#url-input'),
  urlStatus: $('#url-status'),
  saveResult: $('#save-result'),
  notice: $('#notice'),
  list: $('#bookmark-list'),
  empty: $('#empty-state'),
  emptyTitle: $('#empty-title'),
  emptyCopy: $('#empty-copy'),
  resultCount: $('#result-count'),
  search: $('#search-input'),
  title: $('#collection-title'),
  kicker: $('#collection-kicker'),
  tagList: $('#tag-list'),
  allCount: $('#all-count'),
  laterCount: $('#later-count'),
  navAll: $('#nav-all'),
  navLater: $('#nav-later'),
  clearFilter: $('#clear-filter'),
  editBackdrop: $('#edit-backdrop'),
  editForm: $('#edit-form'),
  editTitle: $('#edit-title'),
  editDescription: $('#edit-description'),
  editNote: $('#edit-note'),
  selectedTags: $('#selected-tags'),
  tagSuggestions: $('#tag-suggestions'),
  newTag: $('#new-tag'),
  tagMessage: $('#tag-message'),
  deleteBackdrop: $('#delete-backdrop'),
  deleteHeading: $('#delete-heading')
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function initial(value) {
  return String(value ?? '?').trim().charAt(0).toUpperCase() || '?';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers ?? {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || 'Something went wrong.'), { status: response.status, payload });
  return payload;
}

function showNotice(message, kind = 'success') {
  clearTimeout(state.noticeTimer);
  elements.notice.textContent = message;
  elements.notice.className = `notice show${kind === 'danger' ? ' danger' : ''}`;
  state.noticeTimer = setTimeout(() => { elements.notice.className = 'notice'; }, 5000);
}

function setPreviewLoading(loading) {
  elements.urlStatus.className = loading ? 'url-status loading' : 'url-status';
}

function sourceIcon(item) {
  return item.icon
    ? `<span class="source-icon"><img src="${escapeHtml(item.icon)}" alt="" onerror="this.remove()"></span>`
    : `<span class="source-icon">${escapeHtml(initial(item.source))}</span>`;
}

function previewImage(item, className = 'preview-image') {
  return `<div class="${className}">${item.preview ? `<img src="${escapeHtml(item.preview)}" alt="" onerror="this.remove()">` : ''}</div>`;
}

function renderSaveError(title, copy, warning = false) {
  elements.saveResult.innerHTML = `<div class="save-result ${warning ? 'warning' : 'error'}"><h3 class="result-title">${escapeHtml(title)}</h3><p class="result-copy">${escapeHtml(copy)}</p></div>`;
}

function renderPreview(item) {
  elements.saveResult.innerHTML = `
    <div class="save-result">
      <div class="preview-row">
        ${previewImage(item)}
        <div>
          <div class="source-line">${sourceIcon(item)}<span>${escapeHtml(item.source)}</span></div>
          <h3 class="result-title">${escapeHtml(item.title)}</h3>
          <p class="result-copy">${escapeHtml(item.description || 'No description was provided by this page.')}</p>
        </div>
        <button class="primary-button" type="button" data-save-preview>Save bookmark</button>
      </div>
    </div>`;
}

function renderDuplicate(bookmark) {
  elements.saveResult.innerHTML = `
    <div class="save-result warning">
      <h3 class="result-title">This is already in your library</h3>
      <div class="preview-row">
        ${previewImage(bookmark)}
        <div><div class="source-line">${sourceIcon(bookmark)}<span>${escapeHtml(bookmark.source)}</span></div><p class="result-copy"><strong>${escapeHtml(bookmark.title)}</strong><br>Your original bookmark will be updated—no copy will be made.</p></div>
        <button class="secondary-button" type="button" data-review-duplicate="${escapeHtml(bookmark.id)}">Review &amp; update</button>
      </div>
    </div>`;
}

function renderUnreachable(url, source) {
  elements.saveResult.innerHTML = `
    <div class="save-result warning">
      <h3 class="result-title">We couldn’t reach this page</h3>
      <p class="result-copy">The link is valid, but its details and readable copy could not be gathered. Your address is still here.</p>
      <div class="result-actions"><button class="secondary-button" type="button" data-retry-preview>Try again</button><button class="primary-button" type="button" data-manual-url="${escapeHtml(url)}" data-manual-source="${escapeHtml(source)}">Add details manually</button></div>
    </div>`;
}

function renderManualForm(url, source) {
  elements.saveResult.innerHTML = `
    <form class="save-result warning" id="manual-form">
      <h3 class="result-title">Add bookmark details</h3>
      <p class="result-copy">A readable copy is not available yet. Trove will keep trying after you save.</p>
      <label class="form-field">Title<input name="title" required placeholder="Give this bookmark a title"></label>
      <label class="form-field">Description<textarea name="description" rows="3" placeholder="What is this page about?"></textarea></label>
      <label class="form-field">My note<textarea name="note" rows="3" placeholder="Why did you save this?"></textarea></label>
      <div class="form-actions"><button class="primary-button" type="submit">Save bookmark</button></div>
      <input type="hidden" name="url" value="${escapeHtml(url)}"><input type="hidden" name="source" value="${escapeHtml(source)}">
    </form>`;
}

function validWebAddress(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
}

async function previewAddress() {
  const url = elements.url.value.trim();
  const request = ++state.previewRequest;
  if (!url) { elements.saveResult.innerHTML = ''; setPreviewLoading(false); return; }
  if (!validWebAddress(url)) {
    setPreviewLoading(false);
    renderSaveError('That doesn’t look like a complete web address.', 'Paste a link beginning with http:// or https://.');
    return;
  }
  setPreviewLoading(true);
  elements.saveResult.innerHTML = '<div class="save-result"><p class="result-copy">Gathering title, description, icon, preview, and a readable copy…</p></div>';
  try {
    const result = await api('/api/preview', { method: 'POST', body: JSON.stringify({ url }) });
    if (request !== state.previewRequest) return;
    state.preview = result;
    if (result.kind === 'duplicate') renderDuplicate(result.bookmark);
    else if (result.kind === 'unreachable') renderUnreachable(result.url, result.source);
    else renderPreview(result.preview);
  } catch (error) {
    if (request === state.previewRequest) renderSaveError('We couldn’t check this link', error.message, true);
  } finally {
    if (request === state.previewRequest) setPreviewLoading(false);
  }
}

async function savePreview() {
  if (!state.preview?.preview) return;
  const data = state.preview.preview;
  try {
    const result = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ ...data, url: data.url, archive: data.archive }) });
    elements.url.value = '';
    elements.saveResult.innerHTML = '';
    showNotice('Saved to your library');
    await loadBookmarks(result.bookmark.id);
  } catch (error) {
    if (error.status === 409 && error.payload?.bookmark) renderDuplicate(error.payload.bookmark);
    else showNotice(error.message, 'danger');
  }
}

async function saveManual(form) {
  const data = Object.fromEntries(new FormData(form));
  try {
    const result = await api('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ ...data, tags: [], manualContext: true, originalAvailable: false, archive: { status: 'pending' } })
    });
    elements.url.value = '';
    elements.saveResult.innerHTML = '';
    showNotice('Bookmark saved · readable copy pending');
    await loadBookmarks(result.bookmark.id);
  } catch (error) { showNotice(error.message, 'danger'); }
}

function bookmarkStatus(bookmark) {
  if (bookmark.archive?.status === 'pending') return '<div class="copy-status">● Readable copy pending</div>';
  if (!bookmark.originalAvailable) return '<div class="copy-status">● Original unavailable · saved copy ready</div>';
  return '<div class="copy-status ready">● Readable copy ready</div>';
}

function renderCard(bookmark, highlighted = false) {
  const tags = (bookmark.tags ?? []).map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('');
  return `
    <article class="bookmark-card${highlighted ? ' just-saved' : ''}" tabindex="0" role="link" data-open="${escapeHtml(bookmark.id)}" aria-label="Open ${escapeHtml(bookmark.title)}">
      ${previewImage(bookmark, 'card-image')}
      <div class="card-main">
        ${bookmarkStatus(bookmark)}
        <div class="source-line">${sourceIcon(bookmark)}<span>${escapeHtml(bookmark.source)}</span></div>
        <h3 class="card-title">${escapeHtml(bookmark.title)}</h3>
        <p class="card-description">${escapeHtml(bookmark.description || 'No description')}</p>
        ${bookmark.note ? `<p class="card-note"><strong>My note:</strong> ${escapeHtml(bookmark.note)}</p>` : ''}
        ${tags ? `<div class="card-tags">${tags}</div>` : ''}
      </div>
      <div class="card-actions">
        <button class="later-button${bookmark.readLater ? ' active' : ''}" type="button" data-later="${escapeHtml(bookmark.id)}">${bookmark.readLater ? '✓ Saved for later' : '◷ Read later'}</button>
        <button class="secondary-button" type="button" data-edit="${escapeHtml(bookmark.id)}">Edit bookmark</button>
      </div>
    </article>`;
}

function visibleBookmarks() {
  const needle = state.search.trim().toLocaleLowerCase();
  return state.bookmarks.filter(bookmark => {
    if (state.view === 'later' && !bookmark.readLater) return false;
    if (state.view === 'tag' && !(bookmark.tags ?? []).some(tag => tag.toLocaleLowerCase() === state.activeTag?.toLocaleLowerCase())) return false;
    if (needle && ![bookmark.title, bookmark.description, bookmark.note].some(value => String(value ?? '').toLocaleLowerCase().includes(needle))) return false;
    return true;
  });
}

function renderLibrary(highlightId = null) {
  const result = visibleBookmarks();
  elements.allCount.textContent = state.bookmarks.length;
  elements.laterCount.textContent = state.bookmarks.filter(item => item.readLater).length;
  elements.resultCount.textContent = `${result.length} ${result.length === 1 ? 'bookmark' : 'bookmarks'}`;
  elements.list.innerHTML = result.map(item => renderCard(item, item.id === highlightId)).join('');
  elements.empty.classList.toggle('show', result.length === 0);
  elements.clearFilter.classList.toggle('show', Boolean(state.search || state.view !== 'all'));
  elements.navAll.classList.toggle('active', state.view === 'all');
  elements.navLater.classList.toggle('active', state.view === 'later');

  if (state.view === 'later') {
    elements.title.textContent = 'Read later';
    elements.emptyTitle.textContent = 'Nothing waiting';
    elements.emptyCopy.textContent = 'Your Read later list is all clear. Your bookmarks remain in the main library.';
  } else if (state.view === 'tag') {
    elements.title.textContent = `Tagged ${state.activeTag}`;
    elements.emptyTitle.textContent = `No bookmarks tagged ${state.activeTag}`;
    elements.emptyCopy.textContent = 'Choose another tag or return to all bookmarks.';
  } else if (state.search) {
    elements.title.textContent = 'Search results';
    elements.emptyTitle.textContent = 'No bookmarks match that search';
    elements.emptyCopy.textContent = 'Your search is still in the box. Edit it and try again.';
  } else {
    elements.title.textContent = 'All bookmarks';
    elements.emptyTitle.textContent = 'Your library is ready';
    elements.emptyCopy.textContent = 'Paste your first link above. Its useful details will appear here.';
  }
  renderTagNav();
}

function renderTagNav() {
  const counts = new Map();
  for (const bookmark of state.bookmarks) for (const tag of bookmark.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  elements.tagList.innerHTML = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tag, count]) => `
    <button class="tag-filter-button${state.view === 'tag' && state.activeTag?.toLocaleLowerCase() === tag.toLocaleLowerCase() ? ' active' : ''}" type="button" data-filter-tag="${escapeHtml(tag)}"><span>${escapeHtml(tag)}</span><span>${count}</span></button>`).join('');
  elements.tagList.parentElement.hidden = counts.size === 0;
}

async function loadBookmarks(highlightId = null) {
  const result = await api('/api/bookmarks');
  state.bookmarks = result.bookmarks;
  state.tags = result.tags;
  renderLibrary(highlightId);
}

async function refreshAvailability() {
  if (state.availabilityRefresh || !state.bookmarks.length) return state.availabilityRefresh;
  state.availabilityRefresh = Promise.all(state.bookmarks.map(bookmark =>
    api(`/api/bookmarks/${encodeURIComponent(bookmark.id)}/availability`, { method: 'POST' })
      .then(result => result.bookmark)
      .catch(() => bookmark)
  )).then(bookmarks => {
    const changed = bookmarks.some((bookmark, index) => bookmark.originalAvailable !== state.bookmarks[index]?.originalAvailable);
    state.bookmarks = bookmarks;
    if (changed) renderLibrary();
  }).finally(() => { state.availabilityRefresh = null; });
  return state.availabilityRefresh;
}

function currentEditing() { return state.bookmarks.find(item => item.id === state.editingId); }

function openEdit(id, duplicate = false) {
  const bookmark = state.bookmarks.find(item => item.id === id) ?? state.preview?.bookmark;
  if (!bookmark) return;
  state.editingId = bookmark.id;
  state.editTags = [...(bookmark.tags ?? [])];
  elements.editTitle.value = bookmark.title;
  elements.editDescription.value = bookmark.description;
  elements.editNote.value = bookmark.note;
  $('#edit-context').textContent = duplicate ? 'Update the bookmark you already have—no copy will be made.' : 'Edit the original bookmark and keep all its context together.';
  renderEditTags();
  elements.editBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => elements.editTitle.focus(), 20);
}

function closeEdit() {
  elements.editBackdrop.hidden = true;
  elements.deleteBackdrop.hidden = true;
  state.editingId = null;
  document.body.style.overflow = '';
}

function renderEditTags() {
  elements.selectedTags.innerHTML = state.editTags.map(tag => `<span class="selected-tag"><span>${escapeHtml(tag)}</span><button type="button" aria-label="Remove ${escapeHtml(tag)}" data-remove-tag="${escapeHtml(tag)}">×</button></span>`).join('');
  const selected = new Set(state.editTags.map(tag => tag.toLocaleLowerCase()));
  elements.tagSuggestions.innerHTML = state.tags.filter(tag => !selected.has(tag.toLocaleLowerCase())).map(tag => `<button class="suggestion-tag" type="button" data-suggest-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('');
}

function addEditTag(raw) {
  const tag = String(raw ?? '').trim();
  if (!tag) return;
  if (state.editTags.some(existing => existing.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
    elements.tagMessage.textContent = `“${tag.toLocaleLowerCase()}” is already selected.`;
    elements.tagMessage.className = 'error';
    return;
  }
  const known = state.tags.find(existing => existing.toLocaleLowerCase() === tag.toLocaleLowerCase());
  state.editTags.push(known ?? tag.toLocaleLowerCase());
  elements.newTag.value = '';
  elements.tagMessage.textContent = 'Choose an existing tag, or create a new one.';
  elements.tagMessage.className = '';
  renderEditTags();
}

async function saveEdit() {
  const bookmark = currentEditing();
  if (!bookmark) return;
  try {
    await api(`/api/bookmarks/${encodeURIComponent(bookmark.id)}`, {
      method: 'PUT', body: JSON.stringify({ title: elements.editTitle.value, description: elements.editDescription.value, note: elements.editNote.value, tags: state.editTags })
    });
    closeEdit();
    showNotice('Bookmark details updated');
    await loadBookmarks(bookmark.id);
  } catch (error) { showNotice(error.message, 'danger'); }
}

async function toggleReadLater(id) {
  try {
    const result = await api(`/api/bookmarks/${encodeURIComponent(id)}/read-later`, { method: 'POST' });
    showNotice(result.bookmark.readLater ? 'Added to Read later' : 'Removed from Read later');
    await loadBookmarks();
  } catch (error) { showNotice(error.message, 'danger'); }
}

async function openBookmark(id) {
  const readingTab = window.open('about:blank', '_blank');
  if (readingTab) {
    readingTab.opener = null;
    readingTab.document.write('<title>Opening bookmark…</title><p style="font:16px system-ui;padding:40px">Opening bookmark…</p>');
  }
  try {
    const result = await api(`/api/bookmarks/${encodeURIComponent(id)}/resolve`, { method: 'POST' });
    if (readingTab) readingTab.location.replace(result.url);
    else window.open(result.url, '_blank', 'noopener');
    if (result.target === 'archive') showNotice('Original unavailable · opened saved copy');
    await loadBookmarks();
  } catch (error) {
    readingTab?.close();
    showNotice(error.message, 'danger');
  }
}

elements.url.addEventListener('input', () => {
  clearTimeout(state.previewTimer);
  state.previewRequest += 1;
  setPreviewLoading(false);
  const value = elements.url.value.trim();
  if (!value) { elements.saveResult.innerHTML = ''; return; }
  state.previewTimer = setTimeout(previewAddress, 500);
});

elements.saveResult.addEventListener('click', event => {
  const save = event.target.closest('[data-save-preview]');
  const review = event.target.closest('[data-review-duplicate]');
  const retry = event.target.closest('[data-retry-preview]');
  const manual = event.target.closest('[data-manual-url]');
  if (save) savePreview();
  if (review) openEdit(review.dataset.reviewDuplicate, true);
  if (retry) previewAddress();
  if (manual) renderManualForm(manual.dataset.manualUrl, manual.dataset.manualSource);
});

elements.saveResult.addEventListener('submit', event => {
  if (event.target.matches('#manual-form')) { event.preventDefault(); saveManual(event.target); }
});

elements.search.addEventListener('input', () => { state.search = elements.search.value; renderLibrary(); });
elements.navAll.addEventListener('click', () => { state.view = 'all'; state.activeTag = null; renderLibrary(); });
elements.navLater.addEventListener('click', () => { state.view = 'later'; state.activeTag = null; renderLibrary(); });
elements.tagList.addEventListener('click', event => {
  const button = event.target.closest('[data-filter-tag]');
  if (!button) return;
  state.view = 'tag'; state.activeTag = button.dataset.filterTag; renderLibrary();
});
elements.clearFilter.addEventListener('click', () => {
  state.view = 'all'; state.activeTag = null; state.search = ''; elements.search.value = ''; renderLibrary();
});

elements.list.addEventListener('click', event => {
  const later = event.target.closest('[data-later]');
  const edit = event.target.closest('[data-edit]');
  const card = event.target.closest('[data-open]');
  if (later) { event.stopPropagation(); toggleReadLater(later.dataset.later); return; }
  if (edit) { event.stopPropagation(); openEdit(edit.dataset.edit); return; }
  if (card) openBookmark(card.dataset.open);
});
elements.list.addEventListener('keydown', event => {
  const card = event.target.closest('[data-open]');
  if (card && event.target === card && event.key === 'Enter') { event.preventDefault(); openBookmark(card.dataset.open); }
});

$('#close-edit').addEventListener('click', closeEdit);
elements.editBackdrop.addEventListener('click', event => { if (event.target === elements.editBackdrop) closeEdit(); });
elements.editForm.addEventListener('submit', event => { event.preventDefault(); saveEdit(); });
$('#add-tag').addEventListener('click', () => addEditTag(elements.newTag.value));
elements.newTag.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addEditTag(elements.newTag.value); } });
elements.selectedTags.addEventListener('click', event => {
  const button = event.target.closest('[data-remove-tag]');
  if (!button) return;
  state.editTags = state.editTags.filter(tag => tag.toLocaleLowerCase() !== button.dataset.removeTag.toLocaleLowerCase());
  renderEditTags();
});
elements.tagSuggestions.addEventListener('click', event => {
  const button = event.target.closest('[data-suggest-tag]');
  if (button) addEditTag(button.dataset.suggestTag);
});

$('#request-delete').addEventListener('click', () => {
  const bookmark = currentEditing();
  if (!bookmark) return;
  elements.deleteHeading.textContent = `Delete “${bookmark.title}”?`;
  elements.deleteBackdrop.hidden = false;
});
$('#cancel-delete').addEventListener('click', () => { elements.deleteBackdrop.hidden = true; });
elements.deleteBackdrop.addEventListener('click', event => { if (event.target === elements.deleteBackdrop) elements.deleteBackdrop.hidden = true; });
$('#confirm-delete').addEventListener('click', async () => {
  const bookmark = currentEditing();
  if (!bookmark) return;
  try {
    await api(`/api/bookmarks/${encodeURIComponent(bookmark.id)}`, { method: 'DELETE' });
    closeEdit();
    showNotice('Bookmark deleted');
    await loadBookmarks();
  } catch (error) { showNotice(error.message, 'danger'); }
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!elements.deleteBackdrop.hidden) elements.deleteBackdrop.hidden = true;
  else if (!elements.editBackdrop.hidden) closeEdit();
});

try {
  await loadBookmarks();
  elements.app.dataset.harnessReady = 'true';
  refreshAvailability().catch(() => {});
} catch (error) {
  showNotice('Trove could not load your library. Refresh to try again.', 'danger');
}

setInterval(() => {
  if (!elements.editBackdrop.hidden) return;
  const loading = state.bookmarks.some(item => item.archive?.status === 'pending') ? loadBookmarks() : Promise.resolve();
  loading.then(refreshAvailability).catch(() => {});
}, 30_000);
