const app = document.querySelector('#app');
const toastRegion = document.querySelector('#toast-region');

const state = {
  user: null,
  view: sessionStorage.getItem('stow:view') || 'active',
  query: sessionStorage.getItem('stow:query') || '',
  tag: sessionStorage.getItem('stow:tag') || '',
  items: [],
  tags: [],
  total: 0,
  counts: { active: 0, later: 0, aside: 0 },
  limit: 12,
  loading: false,
  highlightedId: null,
  menuId: null,
  expandedNotes: new Set(),
  draftContext: null
};

const icons = {
  search: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>',
  image: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="8.5" cy="9" r="1.5"></circle><path d="m4 17 5-5 4 4 2-2 5 4"></path></svg>'
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

function safeExternalUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch { return ''; }
}

function hostname(value) {
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function persistFilters() {
  sessionStorage.setItem('stow:view', state.view);
  sessionStorage.setItem('stow:query', state.query);
  sessionStorage.setItem('stow:tag', state.tag);
}

function captureDraft() {
  const dialog = document.querySelector('.dialog-backdrop');
  if (!dialog) return;
  const kind = dialog.dataset.kind;
  if (!kind) return;
  if (kind === 'edit') {
    const id = Number(dialog.dataset.id);
    state.draftContext = {
      kind, id,
      url: dialog.querySelector('[name="url"]')?.value || '',
      title: dialog.querySelector('[name="title"]')?.value || '',
      description: dialog.querySelector('[name="description"]')?.value || ''
    };
  } else if (kind === 'note') {
    state.draftContext = { kind, id: Number(dialog.dataset.id), noteHtml: dialog.querySelector('.editor')?.innerHTML || '' };
  }
  if (state.draftContext) sessionStorage.setItem('stow:draft', JSON.stringify(state.draftContext));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers }
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* an empty response */ }
  if (response.status === 401 && path !== '/api/login') {
    captureDraft();
    closeDialog();
    state.user = null;
    renderLogin('Your session ended. Sign in again to continue where you left off.');
    const error = new Error(payload.error || 'Sign in to continue.');
    error.code = 'AUTH_REQUIRED';
    throw error;
  }
  if (!response.ok) {
    const error = new Error(payload.error || 'Something went wrong.');
    Object.assign(error, payload, { status: response.status });
    throw error;
  }
  return payload;
}

function toast(message, type = '') {
  const element = document.createElement('div');
  element.className = `toast ${type}`;
  element.textContent = message;
  toastRegion.append(element);
  setTimeout(() => element.remove(), 3600);
}

function logo() {
  return '<div class="brand"><span class="brand-mark"><span>S</span></span><span>Stow</span></div>';
}

function renderLogin(message = '') {
  app.innerHTML = `
    <main class="login-page" data-harness-ready="true">
      <section class="login-art">
        ${logo()}
        <div class="login-quote">A quieter place for everything worth finding again.</div>
        <p class="login-caption">Your links, their useful details, and the context you add — gathered into one private collection.</p>
      </section>
      <section class="login-panel">
        <form class="login-form" id="login-form" novalidate>
          <div class="eyebrow">Private collection</div>
          <h1>Welcome back.</h1>
          <p>Sign in to return to your bookmarks.</p>
          <div class="login-error" role="alert">${escapeHtml(message)}</div>
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="username" required>
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
          </div>
          <button class="button" type="submit">Sign in</button>
        </form>
      </section>
    </main>`;
  const form = document.querySelector('#login-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    const errorBox = form.querySelector('.login-error');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Signing in…';
    errorBox.textContent = '';
    const email = form.email.value;
    try {
      const result = await api('/api/login', { method: 'POST', body: JSON.stringify({ email, password: form.password.value }) });
      state.user = result.user;
      renderApp();
      await refresh(true);
      restoreDraft();
    } catch (error) {
      if (error.code !== 'AUTH_REQUIRED') {
        errorBox.textContent = error.message;
        form.email.value = email;
        form.password.value = '';
        form.password.focus();
      }
    } finally {
      if (document.body.contains(button)) {
        button.disabled = false;
        button.textContent = 'Sign in';
      }
    }
  });
}

function renderApp() {
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        ${logo()}
        <div class="account"><span class="account-email">${escapeHtml(state.user.email)}</span><button class="link-button" id="logout">Sign out</button></div>
      </header>
      <main data-harness-ready="true">
        <section class="hero">
          <div>
            <div class="eyebrow">Your private library</div>
            <h1>Keep the good parts of the web.</h1>
            <p class="intro">Paste a link and Stow gathers the useful details. Add your own tags and notes, then find it when it matters.</p>
          </div>
          <form class="save-panel" id="save-form" novalidate>
            <label for="save-url">Save a new link</label>
            <div class="save-row">
              <input id="save-url" name="url" type="url" inputmode="url" placeholder="https://example.com/article" autocomplete="off" aria-describedby="save-error">
              <button class="button" type="submit">Save link</button>
            </div>
            <p class="field-error" id="save-error"></p>
          </form>
        </section>

        <section aria-label="Bookmark collection">
          <div class="collection-bar">
            <nav class="views" aria-label="Collection views" role="tablist">
              <button class="view-button" data-view="active" role="tab">All bookmarks <span data-view-count="active"></span></button>
              <button class="view-button" data-view="later" role="tab">Read later <span data-view-count="later"></span></button>
              <button class="view-button" data-view="aside" role="tab">Set aside <span data-view-count="aside"></span></button>
            </nav>
            <span class="result-count" id="result-count"></span>
          </div>
          <div class="finder">
            <div class="search-wrap">
              ${icons.search}
              <label class="sr-only" for="search">Search bookmarks</label>
              <input id="search" type="search" placeholder="Search titles, notes, descriptions…" value="${escapeHtml(state.query)}">
              <button class="clear-search ${state.query ? '' : 'hidden'}" aria-label="Clear search">×</button>
            </div>
            <div class="tag-filters" id="tag-filters"></div>
          </div>
          <div id="bookmark-list" class="bookmark-list" aria-live="polite"></div>
          <div class="load-more" id="load-more"></div>
        </section>
      </main>
    </div>`;

  bindAppEvents();
  updateViewTabs();
}

function bindAppEvents() {
  document.querySelector('#logout').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    state.user = null;
    state.items = [];
    renderLogin();
  });

  document.querySelector('#save-form').addEventListener('submit', saveBookmark);
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
    state.view = button.dataset.view;
    state.tag = '';
    persistFilters();
    updateViewTabs();
    refresh(true);
  }));

  const search = document.querySelector('#search');
  let searchTimer;
  search.addEventListener('input', () => {
    state.query = search.value;
    document.querySelector('.clear-search').classList.toggle('hidden', !state.query);
    persistFilters();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => refresh(true), 220);
  });
  document.querySelector('.clear-search').addEventListener('click', () => {
    search.value = '';
    state.query = '';
    persistFilters();
    search.focus();
    refresh(true);
  });
}

function updateViewTabs() {
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.view === state.view));
  });
  document.querySelectorAll('[data-view-count]').forEach((element) => {
    const value = state.counts[element.dataset.viewCount] || 0;
    element.textContent = value ? `(${value})` : '';
  });
}

async function refresh(reset = true) {
  if (state.loading) return;
  state.loading = true;
  const offset = reset ? 0 : state.items.length;
  if (reset) document.querySelector('#bookmark-list').innerHTML = '<div class="empty-state"><p>Gathering your bookmarks…</p></div>';
  try {
    const params = new URLSearchParams({ view: state.view, q: state.query, tag: state.tag, limit: state.limit, offset });
    const [result, tagResult] = await Promise.all([
      api(`/api/bookmarks?${params}`),
      api('/api/tags')
    ]);
    state.items = reset ? result.items : [...state.items, ...result.items];
    state.total = result.total;
    state.counts = result.counts;
    state.tags = tagResult.tags;
    updateViewTabs();
    renderTagFilters();
    renderBookmarks();
  } catch (error) {
    if (error.code !== 'AUTH_REQUIRED') toast(error.message, 'error');
  } finally {
    state.loading = false;
  }
}

function renderTagFilters() {
  const container = document.querySelector('#tag-filters');
  if (!container) return;
  const visible = state.tags.slice(0, 10);
  container.innerHTML = visible.length
    ? `<span class="filter-label">Filter by</span>${visible.map((tag) => `<button class="tag-filter" aria-pressed="${String(state.tag.toLowerCase() === tag.name.toLowerCase())}" data-filter-tag="${escapeHtml(tag.name)}">${escapeHtml(tag.name)} <span>${tag.usageCount}</span></button>`).join('')}`
    : '<span class="filter-label">Your tags will appear here.</span>';
  container.querySelectorAll('[data-filter-tag]').forEach((button) => button.addEventListener('click', () => {
    state.tag = state.tag.toLowerCase() === button.dataset.filterTag.toLowerCase() ? '' : button.dataset.filterTag;
    persistFilters();
    refresh(true);
  }));
}

function renderBookmarks() {
  const list = document.querySelector('#bookmark-list');
  const count = document.querySelector('#result-count');
  const more = document.querySelector('#load-more');
  if (!list) return;
  count.textContent = `${state.total} ${state.total === 1 ? 'bookmark' : 'bookmarks'}`;

  if (!state.items.length) {
    const filtered = Boolean(state.query || state.tag);
    const viewCopy = state.view === 'later'
      ? ['Nothing waiting for you', 'Flag a bookmark as Read later and it will appear here.']
      : state.view === 'aside'
        ? ['Nothing set aside', 'Bookmarks you tuck away will stay safe here until you restore them.']
        : ['Your collection is ready', 'Paste your first link above and its useful details will appear here.'];
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">${filtered ? '⌕' : '↗'}</div>
      <h2>${filtered ? 'No bookmarks match' : viewCopy[0]}</h2>
      <p>${filtered ? 'Your search and tag filter are still in place. Adjust or clear them to try again.' : viewCopy[1]}</p>
    </div>`;
  } else {
    list.innerHTML = state.items.map(cardHtml).join('');
    bindCardEvents(list);
    if (state.highlightedId) {
      const highlighted = list.querySelector(`[data-bookmark-id="${state.highlightedId}"]`);
      if (highlighted) {
        highlighted.classList.add('flash');
        highlighted.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => highlighted.classList.remove('flash'), 1700);
        state.highlightedId = null;
      }
    }
  }

  more.innerHTML = state.items.length < state.total ? '<button class="button secondary" id="load-more-button">Load more</button>' : '';
  more.querySelector('button')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'Loading…';
    await refresh(false);
  });
}

function cardHtml(bookmark) {
  const image = safeExternalUrl(bookmark.previewImage);
  const icon = safeExternalUrl(bookmark.siteIcon);
  const url = safeExternalUrl(bookmark.url);
  const hasLongNote = (bookmark.notePlain || '').length > 165;
  const expanded = state.expandedNotes.has(bookmark.id);
  const tags = bookmark.tags.map((tag) => `<span class="tag-chip">${escapeHtml(tag.name)}<button class="tag-remove" data-remove-tag="${tag.id}" aria-label="Remove ${escapeHtml(tag.name)} tag">×</button></span>`).join('');
  const readControl = state.view === 'later'
    ? '<button class="button secondary small" data-mark-read>Mark as read</button>'
    : `<label class="read-later-control"><input type="checkbox" data-read-later ${bookmark.readLater ? 'checked' : ''}> Read later</label>`;
  return `<article class="bookmark-card" data-bookmark-id="${bookmark.id}">
    <a class="preview" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(bookmark.title)}">
      ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" data-image-fallback>` : `<span class="preview-fallback">${icons.image}</span>`}
    </a>
    <div class="card-body">
      <div class="card-top">
        <div class="card-copy">
          <div class="site-line">
            ${icon ? `<img src="${escapeHtml(icon)}" alt="" data-icon-fallback>` : `<span class="site-favicon-fallback">${escapeHtml(bookmark.siteName.slice(0, 1).toUpperCase())}</span>`}
            <span>${escapeHtml(bookmark.siteName)}</span>
          </div>
          <a class="bookmark-title" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(bookmark.title)}</a>
          ${bookmark.description ? `<p class="description">${escapeHtml(bookmark.description)}</p>` : ''}
          <a class="address" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(bookmark.url)}</a>
          ${bookmark.metadataStatus === 'unavailable' ? '<span class="details-unavailable">ⓘ Details unavailable — edit to add your own</span>' : ''}
        </div>
        <div class="menu-wrap">
          <button class="menu-button" aria-label="Bookmark actions" aria-expanded="${String(state.menuId === bookmark.id)}" data-menu-button>•••</button>
          ${state.menuId === bookmark.id ? `<div class="menu">
            <button data-action="edit">Edit details…</button>
            <button data-action="note">${bookmark.noteHtml ? 'Edit note…' : 'Add note…'}</button>
            ${bookmark.archived ? '<button data-action="restore">Restore to bookmarks</button>' : '<button data-action="archive">Set aside</button>'}
            <button class="delete-action" data-action="delete">Delete bookmark…</button>
          </div>` : ''}
        </div>
      </div>
      ${bookmark.noteHtml ? `<div class="note-block"><div class="note-content ${hasLongNote && !expanded ? 'collapsed' : ''}">${bookmark.noteHtml}</div>${hasLongNote ? `<button class="link-button note-toggle" data-note-toggle>${expanded ? 'Show less' : 'Show full note'}</button>` : ''}</div>` : ''}
      <div class="card-lower">
        <div class="tags">${tags}</div>
        <div class="tag-adder">
          <button class="add-tag-button" data-add-tag>+ Add tag</button>
        </div>
        ${bookmark.archived ? '<button class="button secondary small" data-restore>Restore</button>' : readControl}
      </div>
    </div>
  </article>`;
}

function bindCardEvents(list) {
  list.querySelectorAll('[data-image-fallback]').forEach((image) => image.addEventListener('error', () => {
    image.closest('.preview').innerHTML = `<span class="preview-fallback">${icons.image}</span>`;
  }, { once: true }));
  list.querySelectorAll('[data-icon-fallback]').forEach((image) => image.addEventListener('error', () => {
    const fallback = document.createElement('span');
    fallback.className = 'site-favicon-fallback';
    fallback.textContent = image.closest('.bookmark-card').querySelector('.site-line span:last-child').textContent.slice(0, 1).toUpperCase();
    image.replaceWith(fallback);
  }, { once: true }));

  list.querySelectorAll('.bookmark-card').forEach((card) => {
    const id = Number(card.dataset.bookmarkId);
    const bookmark = state.items.find((item) => item.id === id);
    card.querySelector('[data-menu-button]').addEventListener('click', (event) => {
      event.stopPropagation();
      state.menuId = state.menuId === id ? null : id;
      renderBookmarks();
    });
    card.querySelector('[data-read-later]')?.addEventListener('change', async (event) => {
      try {
        await updateBookmark(id, { readLater: event.target.checked });
        await refresh(true);
        toast(event.target.checked ? 'Added to Read later.' : 'Removed from Read later.');
      } catch (error) { event.target.checked = !event.target.checked; toast(error.message, 'error'); }
    });
    card.querySelector('[data-mark-read]')?.addEventListener('click', async () => {
      try { await updateBookmark(id, { readLater: false }); await refresh(true); toast('Marked as read.'); }
      catch (error) { toast(error.message, 'error'); }
    });
    card.querySelector('[data-restore]')?.addEventListener('click', () => archiveBookmark(id, false));
    card.querySelector('[data-add-tag]').addEventListener('click', () => openTagEntry(card, bookmark));
    card.querySelectorAll('[data-remove-tag]').forEach((button) => button.addEventListener('click', async () => {
      try {
        const result = await api(`/api/bookmarks/${id}/tags/${button.dataset.removeTag}`, { method: 'DELETE' });
        replaceItem(result.bookmark);
        await refresh(true);
      } catch (error) { toast(error.message, 'error'); }
    }));
    card.querySelector('[data-note-toggle]')?.addEventListener('click', () => {
      state.expandedNotes.has(id) ? state.expandedNotes.delete(id) : state.expandedNotes.add(id);
      renderBookmarks();
    });
    card.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
      state.menuId = null;
      const action = button.dataset.action;
      if (action === 'edit') showEditDialog(bookmark);
      if (action === 'note') showNoteDialog(bookmark);
      if (action === 'archive') archiveBookmark(id, true);
      if (action === 'restore') archiveBookmark(id, false);
      if (action === 'delete') showDeleteDialog(bookmark);
    }));
  });
}

async function saveBookmark(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = form.url;
  const button = form.querySelector('button');
  const errorBox = form.querySelector('.field-error');
  errorBox.textContent = '';
  input.setAttribute('aria-invalid', 'false');
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span> Reading page…';
  try {
    const result = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: input.value }) });
    input.value = '';
    if (result.bookmark.archived) state.view = 'aside';
    else state.view = 'active';
    state.query = '';
    state.tag = '';
    state.highlightedId = result.bookmark.id;
    persistFilters();
    updateViewTabs();
    await refresh(true);
    toast(result.duplicate ? 'You already saved this link — here it is.' : 'Link saved.');
  } catch (error) {
    if (error.code !== 'AUTH_REQUIRED') {
      errorBox.textContent = error.message;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
  } finally {
    if (document.body.contains(button)) {
      button.disabled = false;
      button.textContent = 'Save link';
    }
  }
}

function openTagEntry(card, bookmark) {
  const adder = card.querySelector('.tag-adder');
  adder.innerHTML = '<input class="tag-entry" aria-label="Tag name" placeholder="Type a tag…" autocomplete="off"><div class="suggestions hidden"></div>';
  const input = adder.querySelector('input');
  const suggestions = adder.querySelector('.suggestions');
  input.focus();
  const updateSuggestions = () => {
    const value = input.value.trim().toLowerCase();
    const currentIds = new Set(bookmark.tags.map((tag) => tag.id));
    const matches = state.tags.filter((tag) => !currentIds.has(tag.id) && (!value || tag.name.toLowerCase().startsWith(value))).slice(0, 6);
    suggestions.innerHTML = matches.map((tag) => `<button type="button" data-suggestion="${escapeHtml(tag.name)}">${escapeHtml(tag.name)}</button>`).join('');
    suggestions.classList.toggle('hidden', !matches.length);
    suggestions.querySelectorAll('button').forEach((button) => button.addEventListener('mousedown', (event) => {
      event.preventDefault();
      addTag(bookmark.id, button.dataset.suggestion);
    }));
  };
  input.addEventListener('input', updateSuggestions);
  input.addEventListener('focus', updateSuggestions);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); addTag(bookmark.id, input.value); }
    if (event.key === 'Escape') renderBookmarks();
  });
  input.addEventListener('blur', () => setTimeout(() => {
    if (document.body.contains(input) && !input.value.trim()) renderBookmarks();
  }, 120));
  updateSuggestions();
}

async function addTag(id, name) {
  if (!name.trim()) return;
  try {
    const result = await api(`/api/bookmarks/${id}/tags`, { method: 'POST', body: JSON.stringify({ name }) });
    replaceItem(result.bookmark);
    await refresh(true);
  } catch (error) { toast(error.message, 'error'); }
}

function replaceItem(bookmark) {
  const index = state.items.findIndex((item) => item.id === bookmark.id);
  if (index >= 0) state.items[index] = bookmark;
}

async function updateBookmark(id, updates) {
  const result = await api(`/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
  replaceItem(result.bookmark);
  renderBookmarks();
  return result.bookmark;
}

async function archiveBookmark(id, archived) {
  try {
    await updateBookmark(id, { archived });
    await refresh(true);
    toast(archived ? 'Bookmark set aside.' : 'Bookmark restored.');
  } catch (error) { toast(error.message, 'error'); }
}

function openDialog(content, { kind = '', id = '', wide = false } = {}) {
  closeDialog();
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  backdrop.dataset.kind = kind;
  backdrop.dataset.id = id;
  backdrop.innerHTML = `<section class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${content}</section>`;
  document.body.append(backdrop);
  backdrop.addEventListener('mousedown', (event) => { if (event.target === backdrop) closeDialog(); });
  backdrop.querySelector('[data-close]')?.addEventListener('click', closeDialog);
  document.addEventListener('keydown', closeOnEscape);
  return backdrop;
}

function closeOnEscape(event) { if (event.key === 'Escape') closeDialog(); }
function closeDialog() { document.querySelector('.dialog-backdrop')?.remove(); document.removeEventListener('keydown', closeOnEscape); }

function showEditDialog(bookmark, restored = null) {
  const data = restored || bookmark;
  const dialog = openDialog(`
    <div class="dialog-head"><div><h2>Edit bookmark</h2><p>Correct the address or the details shown in your collection.</p></div><button class="dialog-close" data-close aria-label="Close">×</button></div>
    <form id="edit-form">
      <div class="field"><label for="edit-url">Web address</label><input id="edit-url" name="url" type="url" value="${escapeHtml(data.url)}" required></div>
      <div class="field"><label for="edit-title">Title</label><input id="edit-title" name="title" value="${escapeHtml(data.title)}" required></div>
      <div class="field"><label for="edit-description">Description</label><textarea id="edit-description" name="description">${escapeHtml(data.description)}</textarea></div>
      <p class="field-error" role="alert"></p>
      <div class="dialog-actions"><button class="button ghost" type="button" data-close>Cancel</button><button class="button" type="submit">Save changes</button></div>
    </form>`, { kind: 'edit', id: bookmark.id });
  dialog.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', closeDialog));
  const form = dialog.querySelector('#edit-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await updateBookmark(bookmark.id, data);
      sessionStorage.removeItem('stow:draft');
      closeDialog();
      toast('Bookmark updated.');
    } catch (error) {
      if (error.code === 'DIFFERENT_PAGE') {
        showPageChangeDialog(bookmark, data);
      } else if (error.code === 'DUPLICATE') {
        closeDialog();
        state.highlightedId = error.bookmark.id;
        state.view = error.bookmark.archived ? 'aside' : 'active';
        persistFilters();
        updateViewTabs();
        await refresh(true);
        toast('That page is already saved — here it is.');
      } else if (error.code !== 'AUTH_REQUIRED') {
        form.querySelector('.field-error').textContent = error.message;
      }
    } finally { if (document.body.contains(submit)) submit.disabled = false; }
  });
}

function showPageChangeDialog(bookmark, data) {
  const dialog = openDialog(`
    <div class="dialog-head"><div><h2>This looks like a different page</h2><p>The new address may have different page details.</p></div><button class="dialog-close" data-close aria-label="Close">×</button></div>
    <p class="dialog-message">Would you like Stow to gather a fresh title, description, site identity, and preview? Your <strong>tags, note, and Read later setting</strong> will stay intact either way.</p>
    <div class="dialog-actions">
      <button class="button ghost" data-choice="cancel">Go back</button>
      <button class="button secondary" data-choice="keep">Keep my written details</button>
      <button class="button" data-choice="refresh">Use details from new page</button>
    </div>`, { kind: 'page-change', id: bookmark.id });
  dialog.querySelectorAll('[data-close], [data-choice="cancel"]').forEach((button) => button.addEventListener('click', () => showEditDialog(bookmark, data)));
  dialog.querySelectorAll('[data-choice="keep"], [data-choice="refresh"]').forEach((button) => button.addEventListener('click', async () => {
    const strategy = button.dataset.choice;
    button.disabled = true;
    try {
      const payload = strategy === 'refresh'
        ? { url: data.url, detailStrategy: strategy }
        : { ...data, detailStrategy: strategy };
      await updateBookmark(bookmark.id, payload);
      sessionStorage.removeItem('stow:draft');
      closeDialog();
      toast('Bookmark updated. Your tags and note were kept.');
    } catch (error) { if (error.code !== 'AUTH_REQUIRED') toast(error.message, 'error'); }
  }));
}

function showNoteDialog(bookmark, restoredHtml = null) {
  const initial = restoredHtml ?? bookmark.noteHtml ?? '';
  const dialog = openDialog(`
    <div class="dialog-head"><div><h2>${bookmark.noteHtml ? 'Edit note' : 'Add a note'}</h2><p>Add context you will want when you find this again.</p></div><button class="dialog-close" data-close aria-label="Close">×</button></div>
    <div class="editor-tools" aria-label="Note formatting">
      <button type="button" data-command="bold"><strong>B</strong><span class="sr-only">Bold</span></button>
      <button type="button" data-command="insertUnorderedList">• List</button>
    </div>
    <div class="editor" contenteditable="true" role="textbox" aria-label="Note" aria-multiline="true" data-placeholder="Write a note…">${initial}</div>
    <div class="preview-label">Preview</div>
    <div class="note-preview"></div>
    <div class="dialog-actions"><button class="button ghost" data-close>Cancel</button><button class="button" data-save-note>Save note</button></div>`, { kind: 'note', id: bookmark.id, wide: true });
  dialog.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', closeDialog));
  const editor = dialog.querySelector('.editor');
  const preview = dialog.querySelector('.note-preview');
  const updatePreview = () => { preview.innerHTML = editor.innerHTML || '<span style="color:#888">Your formatted note will appear here.</span>'; };
  updatePreview();
  editor.addEventListener('input', updatePreview);
  dialog.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('mousedown', (event) => {
    event.preventDefault();
    editor.focus();
    document.execCommand(button.dataset.command, false);
    updatePreview();
  }));
  dialog.querySelector('[data-save-note]').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      await updateBookmark(bookmark.id, { noteHtml: editor.innerHTML });
      sessionStorage.removeItem('stow:draft');
      closeDialog();
      toast('Note saved.');
    } catch (error) { if (error.code !== 'AUTH_REQUIRED') toast(error.message, 'error'); }
  });
  editor.focus();
}

function showDeleteDialog(bookmark) {
  const dialog = openDialog(`
    <div class="dialog-head"><div><h2>Delete bookmark?</h2><p>This cannot be undone.</p></div><button class="dialog-close" data-close aria-label="Close">×</button></div>
    <p class="dialog-message"><strong>${escapeHtml(bookmark.title)}</strong> and its note, tag connections, and Read later setting will be permanently removed. Your other bookmarks and shared tags will not change.</p>
    <div class="dialog-actions"><button class="button ghost" data-close>Keep bookmark</button><button class="button danger" data-delete>Delete permanently</button></div>`, { kind: 'delete', id: bookmark.id });
  dialog.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', closeDialog));
  dialog.querySelector('[data-delete]').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      await api(`/api/bookmarks/${bookmark.id}`, { method: 'DELETE' });
      closeDialog();
      await refresh(true);
      toast('Bookmark deleted.');
    } catch (error) { if (error.code !== 'AUTH_REQUIRED') toast(error.message, 'error'); }
  });
}

function restoreDraft() {
  let draft = state.draftContext;
  if (!draft) {
    try { draft = JSON.parse(sessionStorage.getItem('stow:draft')); } catch { /* no draft */ }
  }
  state.draftContext = null;
  if (!draft) return;
  const bookmark = state.items.find((item) => item.id === draft.id);
  if (!bookmark) return;
  if (draft.kind === 'edit') showEditDialog(bookmark, draft);
  if (draft.kind === 'note') showNoteDialog(bookmark, draft.noteHtml);
  toast('Your unfinished changes are here. Review them and save when ready.');
}

document.addEventListener('click', (event) => {
  if (state.menuId && !event.target.closest('.menu-wrap')) {
    state.menuId = null;
    renderBookmarks();
  }
});

async function boot() {
  try {
    const session = await api('/api/session');
    if (session.signedIn) {
      state.user = session.user;
      renderApp();
      await refresh(true);
      restoreDraft();
    } else renderLogin();
  } catch { renderLogin('Stow could not start. Please try again.'); }
}

boot();
