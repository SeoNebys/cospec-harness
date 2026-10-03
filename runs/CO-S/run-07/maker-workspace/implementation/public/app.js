const state = {
  bookmarks: [],
  view: 'all',
  tag: null,
  query: '',
  visibleCount: 12,
  editingId: null,
  confirmingRemoveId: null,
  expandedIds: new Set(),
  highlightId: null,
  existingDuplicateId: null,
  addTags: [],
};

const elements = {
  app: document.querySelector('#app'),
  list: document.querySelector('#bookmark-list'),
  allCount: document.querySelector('#all-count'),
  laterCount: document.querySelector('#later-count'),
  tagNav: document.querySelector('#tag-nav'),
  title: document.querySelector('#view-title'),
  kicker: document.querySelector('#view-kicker'),
  search: document.querySelector('#search'),
  summary: document.querySelector('#result-summary'),
  activeFilter: document.querySelector('#active-filter'),
  loadMore: document.querySelector('#load-more'),
  dialog: document.querySelector('#bookmark-dialog'),
  addressForm: document.querySelector('#address-form'),
  detailsForm: document.querySelector('#details-form'),
  newUrl: document.querySelector('#new-url'),
  newUrlError: document.querySelector('#new-url-error'),
  newTitle: document.querySelector('#new-title'),
  newTitleError: document.querySelector('#new-title-error'),
  newDescription: document.querySelector('#new-description'),
  newSource: document.querySelector('#new-source'),
  metadataWarning: document.querySelector('#metadata-warning'),
  duplicateWarning: document.querySelector('#duplicate-warning'),
  createError: document.querySelector('#create-error'),
  saveBookmark: document.querySelector('#save-bookmark'),
};

function h(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'className') node.className = value;
    else if (name === 'dataset') Object.assign(node.dataset, value);
    else if (name.startsWith('on') && typeof value === 'function') node.addEventListener(name.slice(2).toLowerCase(), value);
    else if (value === true) node.setAttribute(name, '');
    else if (value !== false && value != null) node.setAttribute(name, String(value));
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'Something went wrong.');
    Object.assign(error, body, { status: response.status });
    throw error;
  }
  return body;
}

function fullAddress(value) {
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function hostname(address) {
  try { return new URL(address).hostname.replace(/^www\./, ''); } catch { return address; }
}

function formatSavedDate(iso) {
  const age = Date.now() - new Date(iso).getTime();
  if (age >= 0 && age < 60_000) return 'Saved just now';
  return `Saved ${new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso))}`;
}

function allTags() {
  const canonical = new Map();
  for (const bookmark of state.bookmarks) {
    for (const tag of bookmark.tags) if (!canonical.has(tag.toLocaleLowerCase())) canonical.set(tag.toLocaleLowerCase(), tag);
  }
  return [...canonical.values()].sort((a, b) => a.localeCompare(b));
}

function showToast(message) {
  const toast = h('div', { className: 'toast' }, message);
  document.querySelector('#toast-region').append(toast);
  setTimeout(() => toast.remove(), 3200);
}

function createTagEditor(container, initialTags, onChange) {
  let selected = [...initialTags];
  const selectedArea = h('div', { className: 'selected-tags' });
  const input = h('input', { type: 'text', placeholder: 'Type to find or create a tag', autocomplete: 'off' });
  const suggestions = h('div', { className: 'tag-suggestions', hidden: true });

  function emit() { onChange([...selected]); }
  function addTag(value) {
    const typed = value.trim();
    if (!typed) return;
    const existing = allTags().find((tag) => tag.toLocaleLowerCase() === typed.toLocaleLowerCase());
    const tag = existing || typed;
    if (!selected.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase())) selected.push(tag);
    input.value = '';
    suggestions.hidden = true;
    renderSelected();
    emit();
    input.focus();
  }
  function renderSelected() {
    selectedArea.replaceChildren(...selected.map((tag) => h('button', {
      type: 'button',
      className: 'selected-tag',
      title: `Remove ${tag}`,
      onClick: () => {
        selected = selected.filter((item) => item !== tag);
        renderSelected();
        emit();
      },
    }, tag)));
  }
  function renderSuggestions() {
    const query = input.value.trim().toLocaleLowerCase();
    const matches = query ? allTags().filter((tag) => tag.toLocaleLowerCase().includes(query) && !selected.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase())) : [];
    suggestions.replaceChildren(...matches.map((tag) => h('button', {
      type: 'button',
      className: 'tag-suggestion',
      onClick: () => addTag(tag),
    }, h('span', {}, tag), h('small', {}, 'Existing tag'))));
    suggestions.hidden = matches.length === 0;
  }
  input.addEventListener('input', renderSuggestions);
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const first = suggestions.querySelector('.tag-suggestion');
    if (first) first.click(); else addTag(input.value);
  });
  input.addEventListener('blur', () => setTimeout(() => { suggestions.hidden = true; }, 120));
  container.replaceChildren(h('div', { className: 'tag-editor' }, selectedArea, input, suggestions, h('p', { className: 'tag-help' }, 'Choose a match, or press Enter to create a new tag.')));
  renderSelected();
  return { focus: () => input.focus(), getTags: () => [...selected] };
}

function filteredBookmarks() {
  const query = state.query.trim().toLocaleLowerCase();
  return state.bookmarks.filter((bookmark) => {
    if (state.view === 'later' && !bookmark.isReadLater) return false;
    if (state.tag && !bookmark.tags.some((tag) => tag.toLocaleLowerCase() === state.tag.toLocaleLowerCase())) return false;
    if (!query) return true;
    return [bookmark.title, bookmark.description, bookmark.url, ...bookmark.tags]
      .some((value) => String(value || '').toLocaleLowerCase().includes(query));
  });
}

function renderNavigation() {
  elements.allCount.textContent = state.bookmarks.length;
  elements.laterCount.textContent = state.bookmarks.filter((bookmark) => bookmark.isReadLater).length;
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view && !state.tag));
  elements.tagNav.replaceChildren(...allTags().map((tag) => {
    const count = state.bookmarks.filter((bookmark) => bookmark.tags.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase())).length;
    return h('button', {
      type: 'button',
      className: `tag-filter${state.tag === tag ? ' active' : ''}`,
      onClick: () => {
        state.tag = tag;
        state.view = 'all';
        state.visibleCount = 12;
        render();
      },
    }, h('span', { className: 'tag-name' }, h('span', { className: 'tag-dot' }), h('span', {}, tag)), h('span', { className: 'nav-count' }, count));
  }));
}

function emptyState(results) {
  if (state.query) return h('div', { className: 'empty-state', dataset: { testid: 'empty-search' } },
    h('div', { className: 'empty-mark' }, '⌕'),
    h('h2', {}, 'No bookmarks found'),
    h('p', {}, `Nothing in your library matches “${state.query}”. Your bookmarks are still here—this search is only hiding them.`),
    h('button', { type: 'button', className: 'button button-secondary', onClick: () => { state.query = ''; elements.search.value = ''; render(); } }, 'Clear search'));
  if (state.view === 'later') return h('div', { className: 'empty-state', dataset: { testid: 'empty-later' } },
    h('div', { className: 'empty-mark' }, 'R'),
    h('h2', {}, 'Nothing saved for later'),
    h('p', {}, 'Mark any bookmark with “Read later” when you want it on this shelf. Your full library is still safe in All bookmarks.'),
    h('button', { type: 'button', className: 'button button-secondary', onClick: () => { state.view = 'all'; render(); } }, 'Show all bookmarks'));
  if (state.tag) return h('div', { className: 'empty-state' }, h('h2', {}, `No bookmarks tagged “${state.tag}”`), h('p', {}, 'Choose another tag or return to all bookmarks.'));
  return h('div', { className: 'empty-state', dataset: { testid: 'empty-library' } },
    h('div', { className: 'empty-mark' }, '+'),
    h('h2', {}, 'Save your first useful page'),
    h('p', {}, 'Paste a web address and Pocketmark will prepare its title and description for you.'),
    h('button', { type: 'button', className: 'button button-primary', onClick: openAddDialog }, 'Add a bookmark'));
}

function bookmarkNeedsCompacting(bookmark) {
  return bookmark.title.length > 100 || bookmark.description.length > 220 || bookmark.url.length > 90 || bookmark.tags.length > 3;
}

function renderCard(bookmark) {
  if (state.editingId === bookmark.id) return renderEditCard(bookmark);
  const compact = bookmarkNeedsCompacting(bookmark);
  const expanded = state.expandedIds.has(bookmark.id);
  const card = h('article', {
    className: `bookmark-card${compact ? ' compact' : ''}${expanded ? ' expanded' : ''}${state.highlightId === bookmark.id ? ' highlight' : ''}`,
    dataset: { id: bookmark.id, openable: 'true', testid: 'bookmark-card' },
    tabindex: '0',
    onClick: () => window.open(bookmark.url, '_blank', 'noopener'),
    onKeydown: (event) => {
      if (event.key === 'Enter') window.open(bookmark.url, '_blank', 'noopener');
    },
  });
  const site = hostname(bookmark.url);
  card.append(
    h('div', { className: 'card-top' },
      h('div', { className: 'site-line' }, h('span', { className: 'site-badge' }, site.charAt(0).toUpperCase()), h('span', { className: 'site-address' }, site)),
      h('span', { className: 'saved-date' }, formatSavedDate(bookmark.createdAt))),
    h('div', { className: 'card-content' },
      h('h2', { className: 'card-title' }, bookmark.title),
      bookmark.description ? h('p', { className: 'card-description' }, bookmark.description) : null),
  );
  if (bookmark.tags.length) {
    const tags = bookmark.tags.map((tag) => h('span', { className: 'tag-pill' }, tag));
    if (bookmark.tags.length > 3) tags.push(h('span', { className: 'tag-pill more-tags' }, `+${bookmark.tags.length - 3} more`));
    card.append(h('div', { className: 'tag-row' }, tags));
  }
  const actions = h('div', { className: 'card-actions' });
  if (compact) actions.append(h('button', {
    type: 'button', className: 'card-action', onClick: (event) => {
      event.stopPropagation();
      if (expanded) state.expandedIds.delete(bookmark.id); else state.expandedIds.add(bookmark.id);
      render();
    },
  }, expanded ? 'Show less' : 'Show full details'));
  actions.append(
    h('button', {
      type: 'button',
      className: `card-action read-later${bookmark.isReadLater ? ' active' : ''}`,
      onClick: async (event) => {
        event.stopPropagation();
        await toggleReadLater(bookmark);
      },
    }, bookmark.isReadLater ? 'Saved for later ✓' : 'Read later'),
    h('button', { type: 'button', className: 'card-action', onClick: (event) => { event.stopPropagation(); state.editingId = bookmark.id; state.confirmingRemoveId = null; render(); } }, 'Edit'),
    h('button', { type: 'button', className: 'card-action remove', onClick: (event) => { event.stopPropagation(); state.confirmingRemoveId = bookmark.id; render(); } }, 'Remove'),
  );
  card.append(actions);
  if (state.confirmingRemoveId === bookmark.id) card.append(renderRemoveConfirmation(bookmark));
  return card;
}

function renderRemoveConfirmation(bookmark) {
  return h('div', { className: 'remove-confirm', onClick: (event) => event.stopPropagation() },
    h('span', {}, h('strong', {}, 'Remove this bookmark? '), 'It will leave both the library and Read later.'),
    h('button', { type: 'button', className: 'button button-quiet', onClick: () => { state.confirmingRemoveId = null; render(); } }, 'Keep bookmark'),
    h('button', { type: 'button', className: 'button button-danger', onClick: async () => {
      try {
        await api(`/api/bookmarks/${encodeURIComponent(bookmark.id)}`, { method: 'DELETE' });
        state.bookmarks = state.bookmarks.filter((item) => item.id !== bookmark.id);
        state.confirmingRemoveId = null;
        showToast('Bookmark removed from your library.');
        render();
      } catch (error) { showToast(error.message); }
    } }, 'Remove bookmark'));
}

function renderEditCard(bookmark) {
  let tags = [...bookmark.tags];
  const card = h('article', { className: 'bookmark-card', dataset: { id: bookmark.id, testid: 'edit-card' } });
  const title = h('input', { value: bookmark.title, 'aria-label': 'Title' });
  const description = h('textarea', { rows: '4', 'aria-label': 'Description' }, bookmark.description);
  const url = h('input', { value: bookmark.url, type: 'url', 'aria-label': 'Web address' });
  const titleError = h('span', { className: 'field-error' });
  const urlError = h('span', { className: 'field-error' });
  const formError = h('p', { className: 'inline-message', hidden: true, role: 'alert' });
  const tagContainer = h('div');
  createTagEditor(tagContainer, tags, (value) => { tags = value; });
  const form = h('form', { className: 'edit-form', novalidate: true },
    h('p', { className: 'kicker' }, 'Editing bookmark'),
    h('label', { className: 'field' }, h('span', {}, 'Title'), title, titleError),
    h('label', { className: 'field' }, h('span', {}, 'Description ', h('small', {}, 'Optional')), description),
    h('label', { className: 'field' }, h('span', {}, 'Web address'), url, urlError),
    h('div', { className: 'field' }, h('span', { className: 'field-label' }, 'Tags'), tagContainer),
    formError,
    h('div', { className: 'form-actions' },
      h('button', { type: 'button', className: 'button button-quiet', onClick: () => { state.editingId = null; render(); } }, 'Cancel'),
      h('button', { type: 'submit', className: 'button button-primary' }, 'Save changes')),
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    titleError.textContent = title.value.trim() ? '' : 'Enter a title so you can recognise this bookmark.';
    urlError.textContent = fullAddress(url.value) ? '' : 'Enter a full web address beginning with http:// or https://';
    if (titleError.textContent || urlError.textContent) return;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    formError.hidden = true;
    try {
      const body = await api(`/api/bookmarks/${encodeURIComponent(bookmark.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ title: title.value, description: description.value, url: url.value, tags, isReadLater: bookmark.isReadLater }),
      });
      replaceBookmark(body.bookmark);
      state.editingId = null;
      showToast('Changes saved');
      render();
    } catch (error) {
      if (error.code === 'DUPLICATE' && error.existing) formError.textContent = 'That address already belongs to another bookmark.';
      else formError.textContent = `${error.message} Your edits are still here. Try again.`;
      formError.hidden = false;
      submit.disabled = false;
    }
  });
  card.append(form);
  setTimeout(() => title.focus(), 0);
  return card;
}

function render() {
  renderNavigation();
  elements.title.textContent = state.view === 'later' ? 'Read later' : 'All bookmarks';
  elements.kicker.textContent = state.view === 'later' ? 'Your reading shelf' : 'Personal library';
  elements.activeFilter.hidden = !state.tag;
  elements.activeFilter.textContent = state.tag ? `Tag: ${state.tag}` : '';
  const results = filteredBookmarks();
  elements.summary.textContent = `${results.length} bookmark${results.length === 1 ? '' : 's'}${state.query ? ` matching “${state.query}”` : ''}`;
  if (results.length === 0) {
    elements.list.replaceChildren(emptyState(results));
    elements.loadMore.hidden = true;
  } else {
    const visible = results.slice(0, state.visibleCount);
    elements.list.replaceChildren(...visible.map(renderCard));
    elements.loadMore.hidden = visible.length >= results.length;
    elements.loadMore.textContent = `Show more bookmarks (${results.length - visible.length} remaining)`;
  }
  if (state.highlightId) {
    const target = elements.list.querySelector(`[data-id="${CSS.escape(state.highlightId)}"]`);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
    setTimeout(() => { state.highlightId = null; }, 1700);
  }
}

function replaceBookmark(bookmark) {
  const index = state.bookmarks.findIndex((item) => item.id === bookmark.id);
  if (index >= 0) state.bookmarks[index] = bookmark;
  else state.bookmarks.unshift(bookmark);
  state.bookmarks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function toggleReadLater(bookmark) {
  try {
    const body = await api(`/api/bookmarks/${encodeURIComponent(bookmark.id)}/read-later`, {
      method: 'PATCH', body: JSON.stringify({ isReadLater: !bookmark.isReadLater }),
    });
    replaceBookmark(body.bookmark);
    showToast(body.bookmark.isReadLater ? 'Added to Read later' : 'Removed from Read later');
    render();
  } catch (error) { showToast(error.message); }
}

let addTagEditor;
function resetAddDialog() {
  elements.addressForm.hidden = false;
  elements.detailsForm.hidden = true;
  elements.newUrl.value = '';
  elements.newUrlError.textContent = '';
  elements.newTitle.value = '';
  elements.newDescription.value = '';
  elements.newTitleError.textContent = '';
  elements.metadataWarning.hidden = true;
  elements.duplicateWarning.hidden = true;
  elements.createError.textContent = '';
  elements.saveBookmark.disabled = false;
  state.addTags = [];
  state.existingDuplicateId = null;
  addTagEditor = createTagEditor(document.querySelector('#new-tag-editor'), [], (tags) => { state.addTags = tags; });
}

function openAddDialog() {
  resetAddDialog();
  elements.dialog.showModal();
  setTimeout(() => elements.newUrl.focus(), 0);
}

document.querySelector('#add-bookmark').addEventListener('click', openAddDialog);
document.querySelector('#close-dialog').addEventListener('click', () => elements.dialog.close());
document.querySelector('#back-to-address').addEventListener('click', () => {
  elements.addressForm.hidden = false;
  elements.detailsForm.hidden = true;
  elements.newUrl.focus();
});
elements.dialog.addEventListener('click', (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});

elements.addressForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = fullAddress(elements.newUrl.value);
  elements.newUrlError.textContent = url ? '' : 'Enter a full web address beginning with http:// or https://';
  if (!url) return;
  const submit = elements.addressForm.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Getting details…';
  elements.metadataWarning.hidden = true;
  try {
    const metadata = await api('/api/metadata', { method: 'POST', body: JSON.stringify({ url }) });
    elements.newTitle.value = metadata.title;
    elements.newDescription.value = metadata.description || '';
  } catch (error) {
    if (error.code !== 'DETAILS_UNAVAILABLE') {
      elements.newUrlError.textContent = error.message;
      submit.disabled = false;
      submit.textContent = 'Get details';
      return;
    }
    elements.newTitle.value = '';
    elements.newDescription.value = '';
    elements.metadataWarning.hidden = false;
  }
  elements.newSource.textContent = hostname(url);
  elements.addressForm.hidden = true;
  elements.detailsForm.hidden = false;
  submit.disabled = false;
  submit.textContent = 'Get details';
  elements.newTitle.focus();
});

elements.detailsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.newTitleError.textContent = elements.newTitle.value.trim() ? '' : 'Enter a title so you can recognise this bookmark.';
  if (elements.newTitleError.textContent) return;
  elements.createError.textContent = '';
  elements.duplicateWarning.hidden = true;
  elements.saveBookmark.disabled = true;
  try {
    const body = await api('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({
        url: elements.newUrl.value,
        title: elements.newTitle.value,
        description: elements.newDescription.value,
        tags: state.addTags,
        isReadLater: false,
      }),
    });
    replaceBookmark(body.bookmark);
    state.view = 'all';
    state.tag = null;
    state.query = '';
    elements.search.value = '';
    state.highlightId = body.bookmark.id;
    elements.dialog.close();
    showToast('Bookmark saved');
    render();
  } catch (error) {
    if (error.code === 'DUPLICATE' && error.existing) {
      state.existingDuplicateId = error.existing.id;
      elements.duplicateWarning.hidden = false;
    } else {
      elements.createError.textContent = `${error.message} Your details are still here. Try again.`;
    }
    elements.saveBookmark.disabled = false;
  }
});

document.querySelector('#view-existing').addEventListener('click', () => {
  elements.dialog.close();
  state.view = 'all';
  state.tag = null;
  state.query = '';
  elements.search.value = '';
  state.highlightId = state.existingDuplicateId;
  state.visibleCount = Math.max(12, state.bookmarks.findIndex((bookmark) => bookmark.id === state.existingDuplicateId) + 1);
  render();
});

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => {
  state.view = button.dataset.view;
  state.tag = null;
  state.visibleCount = 12;
  state.editingId = null;
  render();
}));

elements.search.addEventListener('input', () => {
  state.query = elements.search.value;
  state.visibleCount = 12;
  render();
});

elements.loadMore.addEventListener('click', () => {
  state.visibleCount += 12;
  render();
});

async function start() {
  try {
    const body = await api('/api/bookmarks');
    state.bookmarks = body.bookmarks;
    render();
    elements.app.dataset.harnessReady = 'true';
  } catch (error) {
    elements.list.replaceChildren(h('div', { className: 'empty-state' }, h('h2', {}, 'The library could not load'), h('p', {}, error.message), h('button', { type: 'button', className: 'button button-secondary', onClick: () => location.reload() }, 'Try again')));
  }
}

resetAddDialog();
start();
