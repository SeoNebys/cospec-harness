'use strict';

const state = {
  bookmarks: [],
  counts: { total: 0, readLater: 0, labels: [] },
  view: 'all',
  label: '',
  search: '',
  selectedLabels: [],
  reviewUrl: '',
  editingId: null,
  labelCatalog: []
};

const el = id => document.getElementById(id);
const app = el('app');
const grid = el('bookmarkGrid');
const template = el('bookmarkTemplate');
let toastTimer;
let searchTimer;

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong.');
    error.code = data.code;
    throw error;
  }
  return data;
}

function notify(message) {
  const toast = el('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

function normalizeLabel(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function dateText(iso) {
  const then = new Date(iso);
  const seconds = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));
  if (seconds < 60) return 'Saved just now';
  if (seconds < 3600) return `Saved ${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `Saved ${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  return `Saved ${days} ${days === 1 ? 'day' : 'days'} ago`;
}

function currentQuery() {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.label) params.set('label', state.label);
  if (state.view === 'later') params.set('readLater', '1');
  return params.toString();
}

async function loadBookmarks({ focusId } = {}) {
  const data = await api(`/api/bookmarks?${currentQuery()}`, { headers: {} });
  state.bookmarks = data.bookmarks;
  state.counts = data.counts;
  state.labelCatalog = data.counts.labels;
  render();
  if (focusId) {
    requestAnimationFrame(() => {
      const card = grid.querySelector(`[data-id="${focusId}"]`);
      if (!card) return;
      card.classList.add('focused');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => card.classList.remove('focused'), 3600);
    });
  }
}

function render() {
  el('allCount').textContent = state.counts.total;
  el('laterCount').textContent = state.counts.readLater;
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
  const later = state.view === 'later';
  el('collectionTitle').textContent = later ? 'Read later' : state.label || 'All bookmarks';
  el('collectionSubtitle').textContent = later ? 'The things you meant to come back to.' : state.label ? `Everything you saved under ${state.label}.` : 'Everything worth finding again.';
  const n = state.bookmarks.length;
  el('resultCount').textContent = `${n} ${n === 1 ? 'link' : 'links'} · newest first`;
  el('gridCaption').textContent = state.search ? 'Search results' : later ? 'Waiting to be read' : state.label ? `${state.label} bookmarks` : 'Recently saved';
  renderLabelFilters();
  grid.replaceChildren(...state.bookmarks.map(renderBookmark));
  renderEmpty();
}

function renderLabelFilters() {
  const nav = el('labelFilters');
  nav.hidden = state.view === 'later' || state.counts.labels.length === 0;
  if (nav.hidden) { nav.replaceChildren(); return; }
  const all = document.createElement('button');
  all.className = `filter-chip${state.label ? '' : ' active'}`;
  all.innerHTML = `All <span>${state.counts.total}</span>`;
  all.addEventListener('click', () => { state.label = ''; loadBookmarks(); });
  const chips = state.counts.labels.map(label => {
    const button = document.createElement('button');
    button.className = `filter-chip${normalizeLabel(state.label) === normalizeLabel(label.name) ? ' active' : ''}`;
    const text = document.createTextNode(label.name + ' ');
    const count = document.createElement('span');
    count.textContent = label.count;
    button.append(text, count);
    button.addEventListener('click', () => { state.label = label.name; state.view = 'all'; loadBookmarks(); });
    return button;
  });
  nav.replaceChildren(all, ...chips);
}

function renderEmpty() {
  const empty = el('emptyState');
  const isEmpty = state.bookmarks.length === 0;
  empty.hidden = !isEmpty;
  grid.hidden = isEmpty;
  el('gridCaption').hidden = isEmpty;
  if (!isEmpty) return;
  if (state.search) {
    el('emptyTitle').textContent = 'No saved links match that search.';
    el('emptyCopy').textContent = 'Your collection is still here. Try changing the words above.';
  } else if (state.view === 'later') {
    el('emptyTitle').textContent = 'You’re all caught up.';
    el('emptyCopy').textContent = 'Your bookmarks are still safe in the main collection.';
  } else if (state.label) {
    el('emptyTitle').textContent = `Nothing under ${state.label} yet.`;
    el('emptyCopy').textContent = 'Add this label while saving or editing a bookmark.';
  } else {
    el('emptyTitle').textContent = 'No links yet';
    el('emptyCopy').textContent = 'Your first saved link will appear here.';
  }
}

function renderBookmark(bookmark) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.dataset.id = bookmark.id;
  let domain = bookmark.url;
  try { domain = new URL(bookmark.url).hostname.replace(/^www\./, ''); } catch {}
  card.querySelector('.site-mark').textContent = (domain[0] || '↗').toUpperCase();
  card.querySelector('h3').textContent = bookmark.title;
  const description = card.querySelector('.description');
  description.textContent = bookmark.description;
  description.hidden = !bookmark.description;
  const domainLink = card.querySelector('.domain');
  domainLink.textContent = domain;
  domainLink.href = bookmark.url;
  const laterBadge = card.querySelector('.later-badge');
  laterBadge.hidden = !bookmark.readLater;
  const labelWrap = card.querySelector('.card-labels');
  labelWrap.replaceChildren(...bookmark.labels.map(name => {
    const tag = document.createElement('span');
    tag.className = 'card-label';
    tag.textContent = name;
    return tag;
  }));
  labelWrap.hidden = bookmark.labels.length === 0;
  card.querySelector('.saved-date').textContent = dateText(bookmark.createdAt);
  const editButton = card.querySelector('.more-button');
  editButton.addEventListener('click', () => openReview({ bookmark }));
  setupNote(card, bookmark);
  const done = card.querySelector('.done-button');
  done.hidden = state.view !== 'later';
  done.addEventListener('click', async () => {
    done.disabled = true;
    await api(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: JSON.stringify({ readLater: false }) });
    notify('Marked done — still saved in All bookmarks');
    await loadBookmarks();
  });
  return card;
}

function setupNote(card, bookmark) {
  const display = card.querySelector('.note-display');
  const content = card.querySelector('.note-content');
  const fold = card.querySelector('.fold-button');
  const editor = card.querySelector('.note-editor');
  const noteBox = card.querySelector('.note-box');
  const noteButton = card.querySelector('.note-button');
  const showNote = () => {
    content.innerHTML = bookmark.noteHtml || '';
    display.hidden = !bookmark.noteHtml;
    noteButton.textContent = bookmark.noteHtml ? 'Edit note' : 'Add note';
    if (bookmark.noteHtml) requestAnimationFrame(() => {
      if (content.scrollHeight > 92) {
        content.classList.add('folded');
        fold.hidden = false;
      }
    });
  };
  showNote();
  fold.addEventListener('click', () => {
    const folded = content.classList.toggle('folded');
    fold.textContent = folded ? 'Show full note' : 'Show less';
  });
  noteButton.addEventListener('click', () => {
    display.hidden = true;
    card.querySelector('.card-footer').hidden = true;
    editor.hidden = false;
    noteBox.innerHTML = bookmark.noteHtml || '';
    noteBox.focus();
  });
  card.querySelectorAll('[data-command]').forEach(button => button.addEventListener('mousedown', event => {
    event.preventDefault();
    document.execCommand(button.dataset.command);
    noteBox.focus();
  }));
  card.querySelector('[data-link]').addEventListener('mousedown', event => {
    event.preventDefault();
    const address = window.prompt('Web address for this link:', 'https://');
    if (address) document.execCommand('createLink', false, address);
    noteBox.focus();
  });
  card.querySelector('.note-cancel').addEventListener('click', () => {
    editor.hidden = true;
    card.querySelector('.card-footer').hidden = false;
    showNote();
  });
  card.querySelector('.note-save').addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    const data = await api(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: JSON.stringify({ noteHtml: noteBox.innerHTML }) });
    bookmark.noteHtml = data.bookmark.noteHtml;
    editor.hidden = true;
    card.querySelector('.card-footer').hidden = false;
    content.classList.remove('folded');
    fold.hidden = true;
    showNote();
    event.currentTarget.disabled = false;
    notify('Note saved');
    await refreshCountsOnly();
  });
}

async function refreshCountsOnly() {
  const data = await api('/api/bookmarks', { headers: {} });
  state.counts = data.counts;
  state.labelCatalog = data.counts.labels;
  el('allCount').textContent = state.counts.total;
  el('laterCount').textContent = state.counts.readLater;
}

function renderSelectedLabels() {
  const box = el('selectedLabels');
  box.querySelectorAll('.selected-label').forEach(node => node.remove());
  for (const name of state.selectedLabels) {
    const chip = document.createElement('span');
    chip.className = 'selected-label';
    chip.append(document.createTextNode(name));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${name}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      state.selectedLabels = state.selectedLabels.filter(x => normalizeLabel(x) !== normalizeLabel(name));
      renderSelectedLabels();
    });
    chip.append(remove);
    box.insertBefore(chip, el('labelInput'));
  }
}

function addSelectedLabel(name) {
  const normalized = normalizeLabel(name);
  if (!normalized) return;
  const existing = state.labelCatalog.find(x => normalizeLabel(x.name) === normalized);
  const display = existing?.name || String(name).trim().replace(/\s+/g, ' ');
  if (!state.selectedLabels.some(x => normalizeLabel(x) === normalized)) state.selectedLabels.push(display);
  el('labelInput').value = '';
  el('labelSuggestions').hidden = true;
  renderSelectedLabels();
  el('labelInput').focus();
}

function showLabelSuggestions() {
  const query = normalizeLabel(el('labelInput').value);
  const menu = el('labelSuggestions');
  if (!query) { menu.hidden = true; return; }
  const available = state.labelCatalog.filter(x => normalizeLabel(x.name).includes(query) && !state.selectedLabels.some(y => normalizeLabel(y) === normalizeLabel(x.name)));
  const exact = state.labelCatalog.some(x => normalizeLabel(x.name) === query);
  const rows = available.map(label => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggestion-row';
    button.append(document.createTextNode(label.name));
    const note = document.createElement('span');
    note.textContent = `Used on ${label.count} ${label.count === 1 ? 'link' : 'links'}`;
    button.append(note);
    button.addEventListener('click', () => addSelectedLabel(label.name));
    return button;
  });
  if (!exact) {
    const create = document.createElement('button');
    create.type = 'button';
    create.className = 'suggestion-row';
    create.append(document.createTextNode(`Create “${el('labelInput').value.trim()}”`));
    const note = document.createElement('span');
    note.className = 'new-label';
    note.textContent = 'New label';
    create.append(note);
    create.addEventListener('click', () => addSelectedLabel(el('labelInput').value));
    rows.push(create);
  }
  menu.replaceChildren(...rows);
  menu.hidden = rows.length === 0;
}

function openReview({ url, title = '', description = '', unavailable = false, bookmark = null }) {
  state.editingId = bookmark?.id || null;
  state.reviewUrl = bookmark?.url || url;
  state.selectedLabels = [...(bookmark?.labels || [])];
  el('reviewId').value = state.editingId || '';
  el('reviewKicker').textContent = bookmark ? 'Editing saved bookmark' : 'Review before saving';
  el('reviewTitle').textContent = bookmark ? 'Edit this bookmark.' : unavailable ? 'Fill in what you know.' : 'Make the details yours.';
  el('reviewAddress').textContent = state.reviewUrl;
  el('titleInput').value = bookmark?.title ?? title;
  el('descriptionInput').value = bookmark?.description ?? description;
  el('readLaterInput').checked = bookmark?.readLater || false;
  el('fetchWarning').hidden = !unavailable;
  el('saveBookmarkButton').textContent = bookmark ? 'Save changes' : 'Save bookmark';
  el('reviewError').textContent = '';
  renderSelectedLabels();
  el('reviewDialog').showModal();
  (el('titleInput').value ? el('titleInput') : el('titleInput')).focus();
}

el('urlForm').addEventListener('submit', async event => {
  event.preventDefault();
  const input = el('urlInput');
  const button = el('getDetailsButton');
  el('urlMessage').textContent = '';
  el('urlControl').classList.remove('invalid');
  try {
    const parsed = new URL(input.value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    el('urlMessage').textContent = 'That doesn’t look like a complete web address. Try something like https://example.com/page';
    el('urlControl').classList.add('invalid');
    input.focus();
    return;
  }
  button.disabled = true;
  button.textContent = 'Getting details…';
  try {
    const data = await api('/api/metadata', { method: 'POST', body: JSON.stringify({ url: input.value }) });
    if (data.duplicate) {
      state.view = 'all';
      state.label = '';
      state.search = '';
      el('searchInput').value = '';
      await loadBookmarks({ focusId: data.duplicate.id });
      notify('You already saved this link — here it is.');
    } else {
      openReview(data);
    }
  } catch (error) {
    el('urlMessage').textContent = error.message;
    el('urlControl').classList.add('invalid');
    input.focus();
  } finally {
    button.disabled = false;
    button.textContent = 'Get details';
  }
});

el('reviewForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') { el('reviewDialog').close(); return; }
  const title = el('titleInput').value.trim();
  if (!title) { el('reviewError').textContent = 'Add a title so you can recognize this bookmark later.'; el('titleInput').focus(); return; }
  const button = el('saveBookmarkButton');
  button.disabled = true;
  const payload = { title, description: el('descriptionInput').value, labels: state.selectedLabels, readLater: el('readLaterInput').checked };
  try {
    let result;
    if (state.editingId) result = await api(`/api/bookmarks/${state.editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    else result = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ ...payload, url: state.reviewUrl }) });
    el('reviewDialog').close();
    el('urlInput').value = '';
    if (result.duplicate) {
      state.view = 'all'; state.label = ''; state.search = ''; el('searchInput').value = '';
      await loadBookmarks({ focusId: result.duplicate.id });
      notify('You already saved this link — here it is.');
    } else {
      await loadBookmarks({ focusId: result.bookmark.id });
      notify(state.editingId ? 'Changes saved' : (payload.readLater ? 'Saved to your collection and Read later' : 'Bookmark saved'));
    }
  } catch (error) {
    el('reviewError').textContent = error.message;
  } finally { button.disabled = false; }
});

el('labelInput').addEventListener('input', showLabelSuggestions);
el('labelInput').addEventListener('keydown', event => {
  if (event.key === 'Enter' && el('labelInput').value.trim()) {
    event.preventDefault();
    const query = normalizeLabel(el('labelInput').value);
    const match = state.labelCatalog.find(x => normalizeLabel(x.name) === query) || state.labelCatalog.find(x => normalizeLabel(x.name).includes(query));
    addSelectedLabel(match?.name || el('labelInput').value);
  }
});
document.addEventListener('click', event => { if (!event.target.closest('.label-editor')) el('labelSuggestions').hidden = true; });

document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => {
  state.view = button.dataset.view;
  state.label = '';
  loadBookmarks();
}));

el('searchInput').addEventListener('input', event => {
  state.search = event.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadBookmarks(), 90);
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
    event.preventDefault(); el('searchInput').focus();
  }
});

loadBookmarks().then(() => app.setAttribute('data-harness-ready', 'true')).catch(error => {
  el('emptyState').hidden = false;
  el('emptyTitle').textContent = 'Trove couldn’t load your collection.';
  el('emptyCopy').textContent = error.message;
});
