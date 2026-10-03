const elements = {
  main: document.querySelector('#main'),
  pageTitle: document.querySelector('#page-title'),
  pageSubtitle: document.querySelector('#page-subtitle'),
  allCount: document.querySelector('#all-count'),
  laterCount: document.querySelector('#later-count'),
  sidebarTags: document.querySelector('#sidebar-tags'),
  sidebarEmpty: document.querySelector('#sidebar-empty'),
  saveForm: document.querySelector('#save-form'),
  urlInput: document.querySelector('#url-input'),
  saveButton: document.querySelector('#save-button'),
  saveFeedback: document.querySelector('#save-feedback'),
  manualForm: document.querySelector('#manual-form'),
  manualUrl: document.querySelector('#manual-url'),
  manualDomain: document.querySelector('#manual-domain'),
  manualTitle: document.querySelector('#manual-title'),
  manualDescription: document.querySelector('#manual-description'),
  search: document.querySelector('#search-input'),
  clearSearch: document.querySelector('#clear-search'),
  resultsTitle: document.querySelector('#results-title'),
  activeFilter: document.querySelector('#active-filter'),
  resultCount: document.querySelector('#result-count'),
  loading: document.querySelector('#loading-state'),
  loadError: document.querySelector('#load-error'),
  list: document.querySelector('#bookmark-list'),
  empty: document.querySelector('#empty-state'),
  emptyTitle: document.querySelector('#empty-title'),
  emptyCopy: document.querySelector('#empty-copy'),
  toast: document.querySelector('#toast')
};

const state = {
  bookmarks: [],
  tags: [],
  view: 'all',
  activeTag: '',
  query: '',
  editor: null,
  tagQuery: '',
  expanded: new Set(),
  loaded: false,
  targetId: null
};

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const fold = value => String(value ?? '').toLocaleLowerCase();
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const initials = domain => String(domain || '?').replace(/^www\./, '').split(/[.-]/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || 'Something went wrong.');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function loadState({ ready = false } = {}) {
  elements.loadError.hidden = true;
  if (!state.loaded) elements.loading.hidden = false;
  try {
    const payload = await request('/api/state');
    state.bookmarks = payload.bookmarks;
    state.tags = payload.tags;
    state.loaded = true;
    render();
    if (ready) elements.main.dataset.harnessReady = 'true';
  } catch {
    elements.loading.hidden = true;
    elements.loadError.hidden = false;
    if (ready) elements.main.dataset.harnessReady = 'true';
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove('is-visible'), 2600);
}

function setFeedback(message = '', type = 'error', extra = '') {
  elements.saveFeedback.innerHTML = message ? `<div class="feedback feedback-${type}">${escapeHtml(message)}${extra}</div>` : '';
}

function matches(bookmark, query) {
  const needle = fold(query.trim());
  return !needle || [bookmark.title, bookmark.description, bookmark.note].some(value => fold(value).includes(needle));
}

function noteOnlyMatch(bookmark) {
  const needle = fold(state.query.trim());
  return needle && !fold(`${bookmark.title} ${bookmark.description}`).includes(needle) && fold(bookmark.note).includes(needle);
}

function visibleBookmarks() {
  return state.bookmarks.filter(bookmark => {
    if (state.view === 'readLater' && !bookmark.readLater) return false;
    if (state.view === 'tag' && !bookmark.tags.some(tag => fold(tag) === fold(state.activeTag))) return false;
    return matches(bookmark, state.query);
  });
}

function editorFor(bookmark, kind) {
  if (state.editor?.id !== bookmark.id || state.editor.kind !== kind) return '';
  if (kind === 'details') {
    return `<form class="inline-editor" data-form="details" data-id="${bookmark.id}" novalidate>
      <h4>Correct bookmark details</h4>
      <div class="form-field"><label for="title-${bookmark.id}">Title</label><input id="title-${bookmark.id}" name="title" value="${escapeHtml(bookmark.title)}"></div>
      <div class="form-field"><label for="description-${bookmark.id}">Description <span>(optional)</span></label><textarea id="description-${bookmark.id}" name="description" rows="3">${escapeHtml(bookmark.description)}</textarea></div>
      <div class="form-actions"><button class="button button-ghost" type="button" data-action="close-editor">Cancel</button><button class="button button-primary" type="submit">Save changes</button></div>
    </form>`;
  }
  if (kind === 'note') {
    return `<form class="inline-editor" data-form="note" data-id="${bookmark.id}" novalidate>
      <h4>${bookmark.note ? 'Edit your note' : 'Add a personal note'}</h4>
      <div class="form-field"><label for="note-${bookmark.id}">Your note</label><textarea id="note-${bookmark.id}" name="note" rows="4" placeholder="What do you want to remember about this page?">${escapeHtml(bookmark.note)}</textarea></div>
      <div class="form-actions"><button class="button button-ghost" type="button" data-action="close-editor">Cancel</button><button class="button button-primary" type="submit">Save note</button></div>
    </form>`;
  }
  if (kind === 'tag') {
    const query = state.tagQuery.trim();
    const available = state.tags.map(tag => tag.name).filter(tag => !bookmark.tags.some(own => fold(own) === fold(tag)));
    const matching = query ? available.filter(tag => fold(tag).includes(fold(query))).slice(0, 6) : [];
    let suggestions = '';
    if (query && matching.length) {
      suggestions = matching.map(tag => `<button class="tag-suggestion" type="button" data-action="choose-tag" data-id="${bookmark.id}" data-tag="${escapeHtml(tag)}"><span>${escapeHtml(tag)}</span><span>Used before</span></button>`).join('');
    } else if (query) {
      const created = query[0].toLocaleUpperCase() + query.slice(1);
      suggestions = `<button class="tag-suggestion" type="button" data-action="choose-tag" data-id="${bookmark.id}" data-tag="${escapeHtml(created)}"><span>${escapeHtml(created)}</span><span>Create new tag</span></button>`;
    }
    return `<div class="inline-editor" data-editor="tag"><h4>Add a tag</h4><div class="tag-editor"><label class="sr-only" for="tag-${bookmark.id}">Find or create a tag</label><input id="tag-${bookmark.id}" data-role="tag-input" data-id="${bookmark.id}" value="${escapeHtml(state.tagQuery)}" placeholder="Type to find a tag" autocomplete="off">${suggestions ? `<div class="tag-suggestions">${suggestions}</div>` : ''}</div><div class="form-actions"><button class="button button-ghost" type="button" data-action="close-editor">Cancel</button></div></div>`;
  }
  return '';
}

function bookmarkCard(bookmark) {
  const long = bookmark.title.length > 95 || bookmark.description.length > 180 || bookmark.note.length > 170;
  const expanded = state.expanded.has(bookmark.id);
  const isEditing = state.editor?.id === bookmark.id;
  const currentKind = isEditing ? state.editor.kind : '';
  const noteMatch = noteOnlyMatch(bookmark);
  const tags = bookmark.tags.map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('');
  const note = bookmark.note ? `<div class="note-block ${noteMatch ? 'note-match' : ''}"><strong>${noteMatch ? 'Matched in your note' : 'Your note'}</strong><span class="note-text">${escapeHtml(bookmark.note)}</span></div>` : '';
  const laterLabel = state.view === 'readLater' ? 'Mark as read' : (bookmark.readLater ? 'In Read later' : 'Read later');
  return `<article class="bookmark-card ${long ? 'compact' : ''} ${expanded ? 'is-expanded' : ''} ${state.targetId === bookmark.id ? 'is-target' : ''}" data-bookmark-id="${bookmark.id}" data-url="${escapeHtml(bookmark.url)}" tabindex="0" role="link" aria-label="Open ${escapeHtml(bookmark.title)} in a new tab">
    <div class="site-mark" aria-hidden="true">${escapeHtml(initials(bookmark.domain))}</div>
    <div class="bookmark-main">
      <h3 class="bookmark-title">${escapeHtml(bookmark.title)}</h3>
      ${bookmark.description ? `<p class="bookmark-description">${escapeHtml(bookmark.description)}</p>` : ''}
      <div class="bookmark-meta"><span class="domain">${escapeHtml(bookmark.domain)}</span>${tags}</div>
      ${note}
      ${long && !expanded ? `<button class="show-more" type="button" data-action="expand" data-id="${bookmark.id}">Show full bookmark</button>` : ''}
    </div>
    <div class="card-actions">
      <button class="card-button" type="button" data-action="edit-details" data-id="${bookmark.id}">Edit details</button>
      <button class="card-button" type="button" data-action="edit-note" data-id="${bookmark.id}">${bookmark.note ? 'Edit note' : 'Add note'}</button>
      <button class="card-button" type="button" data-action="edit-tag" data-id="${bookmark.id}">Add tag</button>
      <button class="card-button ${bookmark.readLater && state.view !== 'readLater' ? 'is-on' : ''}" type="button" data-action="toggle-later" data-id="${bookmark.id}">${laterLabel}</button>
    </div>
    ${isEditing ? editorFor(bookmark, currentKind) : ''}
  </article>`;
}

function renderSidebar() {
  elements.allCount.textContent = state.bookmarks.length;
  elements.laterCount.textContent = state.bookmarks.filter(bookmark => bookmark.readLater).length;
  elements.sidebarEmpty.hidden = state.tags.length > 0;
  elements.sidebarTags.innerHTML = state.tags.map(tag => `<button class="tag-nav-button ${state.view === 'tag' && fold(state.activeTag) === fold(tag.name) ? 'is-active' : ''}" type="button" data-action="show-tag" data-tag="${escapeHtml(tag.name)}"><span class="tag-dot"></span><span>${escapeHtml(tag.name)}</span><span class="nav-count">${tag.count}</span></button>`).join('');
  document.querySelectorAll('.nav-button').forEach(button => button.classList.remove('is-active'));
  const active = state.view === 'readLater' ? document.querySelector('[data-action="show-read-later"]') : (state.view === 'all' ? document.querySelector('.nav-button[data-action="show-all"]') : null);
  active?.classList.add('is-active');
}

function render() {
  elements.loading.hidden = true;
  renderSidebar();
  const bookmarks = visibleBookmarks();
  const countText = plural(bookmarks.length, 'bookmark');
  elements.resultCount.textContent = countText;
  elements.clearSearch.hidden = !state.query;
  elements.activeFilter.hidden = state.view !== 'tag';
  elements.activeFilter.textContent = state.view === 'tag' ? state.activeTag : '';

  if (state.view === 'readLater') {
    elements.pageTitle.textContent = 'Read later';
    elements.pageSubtitle.textContent = 'The links you want to come back to.';
    elements.resultsTitle.textContent = 'Waiting to read';
  } else if (state.view === 'tag') {
    elements.pageTitle.textContent = 'Your bookmarks';
    elements.pageSubtitle.textContent = 'Save it once. Find it when it matters.';
    elements.resultsTitle.textContent = 'Bookmarks';
  } else {
    elements.pageTitle.textContent = 'Your bookmarks';
    elements.pageSubtitle.textContent = 'Save it once. Find it when it matters.';
    elements.resultsTitle.textContent = state.query ? `Results for “${state.query}”` : 'All bookmarks';
  }

  elements.list.innerHTML = bookmarks.map(bookmarkCard).join('');
  elements.empty.hidden = bookmarks.length > 0 || !state.loaded;
  if (!bookmarks.length) {
    if (state.query) {
      elements.emptyTitle.textContent = 'No bookmarks match that search';
      elements.emptyCopy.textContent = 'Try another word or clear the search to return to your library.';
    } else if (state.view === 'readLater') {
      elements.emptyTitle.textContent = 'Nothing waiting here';
      elements.emptyCopy.textContent = 'Bookmarks you mark as read stay safe in All bookmarks.';
    } else if (state.view === 'tag') {
      elements.emptyTitle.textContent = `No bookmarks tagged ${state.activeTag}`;
      elements.emptyCopy.textContent = 'Choose another tag or return to all bookmarks.';
    } else {
      elements.emptyTitle.textContent = 'No bookmarks yet';
      elements.emptyCopy.textContent = 'Your saved links will appear here with details you can recognize.';
    }
  }

  queueMicrotask(() => {
    const tagInput = document.querySelector('[data-role="tag-input"]');
    if (tagInput && state.editor?.kind === 'tag') {
      tagInput.focus();
      tagInput.setSelectionRange(tagInput.value.length, tagInput.value.length);
    }
  });
}

function openEditor(id, kind) {
  state.editor = { id, kind };
  state.tagQuery = '';
  render();
  queueMicrotask(() => document.querySelector(`[data-bookmark-id="${id}"] textarea, [data-bookmark-id="${id}"] input`)?.focus());
}

async function patchBookmark(id, changes, successMessage) {
  const payload = await request(`/api/bookmarks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(changes) });
  state.bookmarks = state.bookmarks.map(bookmark => bookmark.id === id ? payload.bookmark : bookmark);
  state.tags = tagCounts(state.bookmarks);
  state.editor = null;
  state.tagQuery = '';
  render();
  showToast(successMessage);
}

function tagCounts(bookmarks) {
  const counts = new Map();
  for (const bookmark of bookmarks) for (const tag of bookmark.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));
}

elements.saveForm.addEventListener('submit', async event => {
  event.preventDefault();
  elements.urlInput.classList.remove('is-invalid');
  setFeedback();
  elements.manualForm.hidden = true;
  const url = elements.urlInput.value.trim();
  elements.saveButton.disabled = true;
  elements.saveButton.textContent = 'Getting details…';
  try {
    const payload = await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url }) });
    state.bookmarks.unshift(payload.bookmark);
    state.tags = tagCounts(state.bookmarks);
    state.view = 'all';
    state.activeTag = '';
    elements.urlInput.value = '';
    render();
    showToast('Bookmark saved with page details');
  } catch (error) {
    if (error.payload?.code === 'invalid_address') {
      elements.urlInput.classList.add('is-invalid');
      setFeedback(error.message, 'error');
      elements.urlInput.focus();
    } else if (error.payload?.code === 'metadata_unavailable') {
      setFeedback(error.message, 'warning');
      elements.manualUrl.value = error.payload.url;
      elements.manualDomain.textContent = error.payload.domain;
      elements.manualTitle.value = '';
      elements.manualDescription.value = '';
      elements.manualForm.hidden = false;
      elements.manualTitle.focus();
    } else if (error.payload?.code === 'duplicate') {
      const bookmark = error.payload.bookmark;
      setFeedback(error.message, 'warning', `<div class="duplicate-preview"><span class="site-mark">${escapeHtml(initials(bookmark.domain))}</span><div><strong>${escapeHtml(bookmark.title)}</strong><span>${escapeHtml(bookmark.domain)} · Already saved</span></div></div>`);
      state.view = 'all'; state.activeTag = ''; state.targetId = bookmark.id; render();
      queueMicrotask(() => document.querySelector(`[data-bookmark-id="${bookmark.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } else setFeedback(error.message, 'error');
  } finally {
    elements.saveButton.disabled = false;
    elements.saveButton.textContent = 'Save bookmark';
  }
});

elements.manualForm.addEventListener('submit', async event => {
  event.preventDefault();
  elements.manualTitle.classList.remove('is-invalid');
  elements.manualForm.querySelector('.field-error')?.remove();
  try {
    const payload = await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ manual: true, url: elements.manualUrl.value, title: elements.manualTitle.value, description: elements.manualDescription.value }) });
    state.bookmarks.unshift(payload.bookmark); state.tags = tagCounts(state.bookmarks); state.view = 'all'; elements.urlInput.value = ''; elements.manualForm.hidden = true; setFeedback(); render(); showToast('Bookmark saved with your details');
  } catch (error) {
    if (error.payload?.code === 'title_required') {
      elements.manualTitle.classList.add('is-invalid');
      elements.manualTitle.insertAdjacentHTML('afterend', `<p class="field-error">${escapeHtml(error.message)}</p>`);
      elements.manualTitle.focus();
    } else setFeedback(error.message, 'error');
  }
});

elements.search.addEventListener('input', event => { state.query = event.target.value; render(); });
elements.clearSearch.addEventListener('click', () => { state.query = ''; elements.search.value = ''; render(); elements.search.focus(); });

document.addEventListener('input', event => {
  if (event.target.matches('[data-role="tag-input"]')) {
    state.tagQuery = event.target.value;
    render();
  }
});

document.addEventListener('submit', async event => {
  const form = event.target;
  if (!form.matches('[data-form]')) return;
  event.preventDefault();
  const id = form.dataset.id;
  form.querySelectorAll('.field-error').forEach(node => node.remove());
  form.querySelectorAll('.is-invalid').forEach(node => node.classList.remove('is-invalid'));
  try {
    if (form.dataset.form === 'details') {
      const title = form.elements.title.value;
      if (!title.trim()) {
        form.elements.title.classList.add('is-invalid');
        form.elements.title.insertAdjacentHTML('afterend', '<p class="field-error">Add a title so you can recognize this bookmark later.</p>');
        form.elements.title.focus();
        return;
      }
      await patchBookmark(id, { title, description: form.elements.description.value }, 'Bookmark details updated');
    } else if (form.dataset.form === 'note') {
      const note = form.elements.note.value.trim();
      if (!note) {
        form.elements.note.classList.add('is-invalid');
        form.elements.note.insertAdjacentHTML('afterend', '<p class="field-error">Write a note before saving.</p>');
        form.elements.note.focus();
        return;
      }
      await patchBookmark(id, { note }, 'Note saved and searchable');
    }
  } catch (error) {
    const field = form.querySelector('input, textarea');
    field?.insertAdjacentHTML('afterend', `<p class="field-error">${escapeHtml(error.message)}</p>`);
  }
});

document.addEventListener('click', async event => {
  const actionElement = event.target.closest('[data-action]');
  if (actionElement) {
    const action = actionElement.dataset.action;
    if (action === 'show-all') { event.preventDefault(); state.view = 'all'; state.activeTag = ''; state.editor = null; render(); return; }
    if (action === 'show-read-later') { state.view = 'readLater'; state.activeTag = ''; state.editor = null; render(); return; }
    if (action === 'show-tag') { state.view = 'tag'; state.activeTag = actionElement.dataset.tag; state.editor = null; render(); return; }
    if (action === 'retry-load') { await loadState(); return; }
    if (action === 'cancel-manual') { elements.manualForm.hidden = true; setFeedback(); return; }
    if (action === 'close-editor') { state.editor = null; state.tagQuery = ''; render(); return; }
    if (action === 'edit-details') { openEditor(actionElement.dataset.id, 'details'); return; }
    if (action === 'edit-note') { openEditor(actionElement.dataset.id, 'note'); return; }
    if (action === 'edit-tag') { openEditor(actionElement.dataset.id, 'tag'); return; }
    if (action === 'expand') { state.expanded.add(actionElement.dataset.id); render(); return; }
    if (action === 'choose-tag') {
      const bookmark = state.bookmarks.find(item => item.id === actionElement.dataset.id);
      if (!bookmark) return;
      try { await patchBookmark(bookmark.id, { tags: [...bookmark.tags, actionElement.dataset.tag] }, `“${actionElement.dataset.tag}” added`); }
      catch (error) { showToast(error.message); }
      return;
    }
    if (action === 'toggle-later') {
      const bookmark = state.bookmarks.find(item => item.id === actionElement.dataset.id);
      if (!bookmark) return;
      const next = state.view === 'readLater' ? false : !bookmark.readLater;
      try { await patchBookmark(bookmark.id, { readLater: next }, next ? 'Saved to Read later' : 'Marked as read — bookmark kept in your library'); }
      catch (error) { showToast(error.message); }
      return;
    }
  }

  const card = event.target.closest('.bookmark-card');
  if (card && !event.target.closest('button, input, textarea, form')) window.open(card.dataset.url, '_blank', 'noopener');
});

document.addEventListener('keydown', event => {
  const card = event.target.closest('.bookmark-card');
  if (card && event.target === card && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    window.open(card.dataset.url, '_blank', 'noopener');
  }
});

loadState({ ready: true });
