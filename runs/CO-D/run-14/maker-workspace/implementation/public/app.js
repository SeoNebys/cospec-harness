const $ = selector => document.querySelector(selector);

const state = {
  authenticated: false, section: 'library', query: '', bookmarks: [], tags: [],
  total: 0, readLaterCount: 0, selectedTags: [], dialogMode: null, dialogBookmark: null,
  previewToken: null, unavailableBookmark: null, toastTimer: null
};

document.querySelectorAll('.dialog-close, .dialog-actions button[value="cancel"]').forEach(button => {
  button.addEventListener('click', event => {
    event.preventDefault();
    button.closest('dialog')?.close();
  });
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: response.status, data });
  return data;
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message; element.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => { element.hidden = true; }, 3500);
}

function setLoading(loading) {
  $('#loadingText').hidden = !loading;
}

async function init() {
  const session = await api('/api/session');
  state.authenticated = session.authenticated;
  if (session.authenticated) {
    $('#accountEmail').textContent = session.email;
    showApp();
    await loadBookmarks();
  } else showLogin();
}

function showLogin() {
  $('#appView').hidden = true; $('#loginView').hidden = false;
  setTimeout(() => $('#password').focus(), 0);
}

function showApp() {
  $('#loginView').hidden = true; $('#appView').hidden = false;
}

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault(); $('#loginError').hidden = true;
  const email = $('#email').value;
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ email, password: $('#password').value }) });
    $('#accountEmail').textContent = email; state.authenticated = true; showApp(); await loadBookmarks();
  } catch {
    $('#loginError').hidden = false; $('#password').value = ''; $('#password').focus();
  }
});

$('#logoutButton').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' }); state.authenticated = false; showLogin();
});

async function loadBookmarks() {
  setLoading(true);
  const params = new URLSearchParams({ section: state.section });
  if (state.query) params.set('q', state.query);
  try {
    const data = await api(`/api/bookmarks?${params}`);
    state.bookmarks = data.bookmarks; state.tags = data.tags; state.total = data.total; state.readLaterCount = data.readLaterCount;
    $('#searchError').hidden = true;
    renderInterpretation(data.interpretation);
    render();
  } catch (error) {
    if (error.status === 400) {
      $('#searchError').textContent = error.message; $('#searchError').hidden = false;
    } else toast(error.message);
  } finally { setLoading(false); }
}

function renderInterpretation(values) {
  const element = $('#interpretation');
  if (state.query && values?.length) { $('#interpretationText').textContent = values.join(' · '); element.hidden = false; }
  else element.hidden = true;
}

function render() {
  $('#libraryCount').textContent = state.total;
  $('#laterCount').textContent = state.readLaterCount;
  document.querySelectorAll('.nav-button').forEach(button => button.classList.toggle('active', button.dataset.section === state.section));
  const later = state.section === 'later';
  $('#sectionEyebrow').textContent = later ? 'Reading queue' : 'Personal collection';
  $('#sectionTitle').textContent = later ? 'Read later' : 'Your library';
  $('#sectionSubtitle').textContent = later ? 'A focused pile for when you have time.' : 'Everything you’ve saved, ready to find again.';
  $('#clearSearch').hidden = !state.query;
  $('#resultCount').textContent = `${state.bookmarks.length} ${state.bookmarks.length === 1 ? 'bookmark' : 'bookmarks'}`;
  const list = $('#bookmarkList'); list.replaceChildren(...state.bookmarks.map(renderCard));
  renderEmpty();
}

function renderEmpty() {
  const empty = $('#emptyState');
  if (state.bookmarks.length) { empty.hidden = true; return; }
  empty.hidden = false;
  const action = $('#emptyAction'); action.hidden = true;
  if (state.query) {
    $('#emptySymbol').textContent = '⌕'; $('#emptyTitle').textContent = 'No bookmarks match';
    $('#emptyCopy').textContent = `Nothing in your library matches “${state.query}”.`;
    action.textContent = 'Clear search'; action.hidden = false; action.dataset.action = 'clear-search';
  } else if (state.section === 'later') {
    $('#emptySymbol').textContent = '✓'; $('#emptyTitle').textContent = 'You’re all caught up';
    $('#emptyCopy').textContent = 'Your bookmarks are safe in the library whenever you need them.';
    action.textContent = 'Browse library'; action.hidden = false; action.dataset.action = 'library';
  } else {
    $('#emptySymbol').textContent = '⌁'; $('#emptyTitle').textContent = 'Your first good find belongs here';
    $('#emptyCopy').textContent = 'Paste a web address above to begin your library.';
  }
}

$('#emptyAction').addEventListener('click', () => {
  if ($('#emptyAction').dataset.action === 'clear-search') clearSearch();
  else changeSection('library');
});

function renderCard(bookmark) {
  const article = document.createElement('article'); article.className = 'bookmark-card'; article.dataset.id = bookmark.id;
  const icon = document.createElement('div'); icon.className = 'bookmark-icon';
  if (bookmark.favicon) {
    const image = new Image(); image.src = bookmark.favicon; image.alt = ''; image.addEventListener('error', () => { icon.textContent = bookmark.title.charAt(0).toUpperCase(); }); icon.append(image);
  } else icon.textContent = bookmark.title.charAt(0).toUpperCase();
  const body = document.createElement('div');
  const heading = document.createElement('h2'); heading.className = 'bookmark-title';
  if (bookmark.originalAvailable === false) {
    const button = document.createElement('button'); button.textContent = bookmark.title; button.addEventListener('click', () => openUnavailable(bookmark)); heading.append(button);
  } else {
    const link = document.createElement('a'); link.href = bookmark.url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = bookmark.title; heading.append(link);
  }
  const description = document.createElement('p'); description.className = 'bookmark-description'; description.textContent = bookmark.description || 'No page description available yet.';
  const meta = document.createElement('div'); meta.className = 'bookmark-meta'; meta.textContent = compactUrl(bookmark.url);
  const tags = document.createElement('div'); tags.className = 'tag-row';
  for (const name of bookmark.tags) { const chip = document.createElement('span'); chip.className = 'tag-chip'; chip.textContent = name; tags.append(chip); }
  body.append(heading, description, meta, tags);
  const capture = document.createElement('div'); capture.className = `capture-status${bookmark.capture.status === 'ready' ? ' ready' : ''}`;
  capture.textContent = bookmark.capture.status === 'ready' ? '● Saved copy ready' : '↻ Waiting for page · retrying automatically';
  body.append(capture);
  const actions = document.createElement('div'); actions.className = 'card-actions';
  if (state.section === 'later') actions.append(actionButton('Mark read', 'secondary', () => setReadLater(bookmark, false, true)));
  else actions.append(actionButton(bookmark.readLater ? 'In Read later' : '+ Read later', 'secondary', () => setReadLater(bookmark, !bookmark.readLater)));
  actions.append(actionButton('Edit', 'secondary', () => openEditor(bookmark)));
  if (bookmark.capture.status === 'ready') actions.append(actionButton('Saved copy', 'secondary', () => openArchive(bookmark.id)));
  const remove = actionButton('Delete', 'secondary delete-button', () => openDelete(bookmark)); actions.append(remove);
  article.append(icon, body, actions); return article;
}

function actionButton(label, classes, callback) {
  const button = document.createElement('button'); button.className = `button ${classes}`; button.type = 'button'; button.textContent = label; button.addEventListener('click', callback); return button;
}

function compactUrl(value) {
  try { const url = new URL(value); return `${url.host}${url.pathname}${url.search}`; } catch { return value; }
}

document.querySelectorAll('.nav-button').forEach(button => button.addEventListener('click', () => changeSection(button.dataset.section)));
function changeSection(section) { state.section = section; state.query = ''; $('#searchInput').value = ''; loadBookmarks(); }

$('#searchForm').addEventListener('submit', event => {
  event.preventDefault(); state.query = $('#searchInput').value.trim(); loadBookmarks();
});
$('#clearSearch').addEventListener('click', clearSearch);
function clearSearch() { state.query = ''; $('#searchInput').value = ''; $('#searchError').hidden = true; loadBookmarks(); }

$('#demoLink').addEventListener('click', () => { $('#urlInput').value = `${location.origin}/demo/original/rome`; $('#urlInput').focus(); });
$('#saveForm').addEventListener('submit', async event => {
  event.preventDefault();
  const raw = $('#urlInput').value.trim(); const error = validateAddress(raw);
  if (error) { showUrlError(error); return; }
  showUrlError(''); setLoading(true);
  try {
    const result = await api('/api/bookmarks/preview', { method: 'POST', body: JSON.stringify({ url: raw }) });
    if (result.kind === 'duplicate') openEditor(result.bookmark, true);
    else openReview(result);
  } catch (failure) { showUrlError(failure.message); }
  finally { setLoading(false); }
});

function validateAddress(value) {
  if (!value) return 'Paste a web address to continue.';
  try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); }
  catch { return 'This doesn’t look like a complete web address. Try one beginning with http:// or https://.'; }
  return '';
}
function showUrlError(message) {
  $('#urlError').textContent = message; $('#urlError').hidden = !message; $('#saveForm').classList.toggle('invalid', Boolean(message));
  if (message) $('#urlInput').focus();
}

function openReview(result) {
  state.dialogMode = 'create'; state.dialogBookmark = null; state.previewToken = result.token; state.selectedTags = [];
  const unreachable = result.kind === 'unreachable'; const details = result.details || {};
  $('#bookmarkDialogEyebrow').textContent = unreachable ? 'Save while unavailable' : 'New bookmark';
  $('#bookmarkDialogTitle').textContent = unreachable ? 'Save this address for now' : 'Review before saving';
  $('#bookmarkDialogLead').textContent = unreachable ? 'Add your own title. Keepwell will finish the details when the page returns.' : 'We found these details. You have the final say.';
  $('#captureWarning').hidden = !unreachable; $('#duplicateNotice').hidden = true;
  $('#previewUrl').textContent = result.url; $('#previewHost').textContent = hostname(result.url); $('#previewIcon').textContent = (details.title || hostname(result.url)).charAt(0).toUpperCase();
  $('#bookmarkTitleInput').value = details.title || ''; $('#bookmarkDescriptionInput').value = details.description || '';
  $('#bookmarkDescriptionInput').closest('label'); $('#bookmarkDescriptionInput').hidden = false; $('#descriptionLabel').hidden = false;
  $('#bookmarkNotesInput').value = ''; $('#bookmarkReadLater').checked = false; $('#bookmarkSubmit').textContent = unreachable ? 'Save for now' : 'Save bookmark';
  $('#bookmarkFormError').hidden = true; renderSelectedTags(); $('#bookmarkDialog').showModal();
  setTimeout(() => (unreachable ? $('#bookmarkTitleInput') : $('#bookmarkTitleInput')).focus(), 0);
}

function openEditor(bookmark, duplicate = false) {
  state.dialogMode = 'edit'; state.dialogBookmark = bookmark; state.previewToken = null; state.selectedTags = [...bookmark.tags];
  $('#bookmarkDialogEyebrow').textContent = duplicate ? 'Duplicate prevented' : 'Saved bookmark';
  $('#bookmarkDialogTitle').textContent = duplicate ? 'Already in your library' : 'Edit bookmark';
  $('#bookmarkDialogLead').textContent = duplicate ? 'No second copy will be created. Your existing details are ready to adjust.' : 'Tidy your details without changing the address or saved copy.';
  $('#captureWarning').hidden = true; $('#duplicateNotice').hidden = !duplicate;
  $('#previewUrl').textContent = bookmark.url; $('#previewHost').textContent = hostname(bookmark.url); $('#previewIcon').textContent = bookmark.title.charAt(0).toUpperCase();
  $('#bookmarkTitleInput').value = bookmark.title; $('#bookmarkDescriptionInput').value = bookmark.description || '';
  const direct = !duplicate; $('#bookmarkDescriptionInput').hidden = direct; $('#descriptionLabel').hidden = direct;
  $('#bookmarkNotesInput').value = bookmark.notes || ''; $('#bookmarkReadLater').checked = bookmark.readLater; $('#bookmarkSubmit').textContent = 'Save changes';
  $('#bookmarkFormError').hidden = true; renderSelectedTags(); $('#bookmarkDialog').showModal();
}

function hostname(value) { try { return new URL(value).hostname; } catch { return 'Saved page'; } }

$('#bookmarkTagInput').addEventListener('input', renderTagSuggestions);
function renderTagSuggestions() {
  const input = $('#bookmarkTagInput'), query = input.value.trim().toLowerCase(), box = $('#bookmarkTagSuggestions');
  const matches = state.tags.filter(tag => query && tag.includes(query) && !state.selectedTags.includes(tag));
  const choices = matches.map(tag => suggestionButton(tag, () => chooseTag(tag)));
  if (query && !state.tags.includes(query) && !state.selectedTags.includes(query)) choices.push(suggestionButton(`Create new tag “${query}”`, () => chooseTag(query)));
  box.replaceChildren(...choices); box.hidden = !choices.length;
}
function suggestionButton(label, callback) { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.addEventListener('click', callback); return button; }
function chooseTag(value) { const tag = value.trim().toLowerCase(); if (tag && !state.selectedTags.includes(tag)) state.selectedTags.push(tag); $('#bookmarkTagInput').value = ''; $('#bookmarkTagSuggestions').hidden = true; renderSelectedTags(); }
function renderSelectedTags() {
  const box = $('#bookmarkSelectedTags'); box.replaceChildren(...state.selectedTags.map(tag => {
    const chip = document.createElement('span'); chip.className = 'tag-chip'; chip.append(document.createTextNode(tag));
    const remove = document.createElement('button'); remove.type = 'button'; remove.setAttribute('aria-label', `Remove ${tag}`); remove.textContent = '×';
    remove.addEventListener('click', () => { state.selectedTags = state.selectedTags.filter(value => value !== tag); renderSelectedTags(); }); chip.append(remove); return chip;
  }));
}

$('#bookmarkForm').addEventListener('submit', async event => {
  event.preventDefault();
  const title = $('#bookmarkTitleInput').value.trim();
  if (!title) { $('#bookmarkFormError').textContent = 'Add a title before saving.'; $('#bookmarkFormError').hidden = false; return; }
  const common = { title, notes: $('#bookmarkNotesInput').value, tags: state.selectedTags, readLater: $('#bookmarkReadLater').checked };
  try {
    if (state.dialogMode === 'create') {
      await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ ...common, token: state.previewToken, description: $('#bookmarkDescriptionInput').value }) });
      $('#urlInput').value = ''; toast('Bookmark saved to your library.');
    } else {
      const payload = { ...common };
      if (!$('#bookmarkDescriptionInput').hidden) payload.description = $('#bookmarkDescriptionInput').value;
      await api(`/api/bookmarks/${state.dialogBookmark.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      toast('Changes saved to this bookmark.');
    }
    $('#bookmarkDialog').close(); await loadBookmarks();
  } catch (error) { $('#bookmarkFormError').textContent = error.message; $('#bookmarkFormError').hidden = false; }
});

async function setReadLater(bookmark, value, completed = false) {
  try {
    await api(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: JSON.stringify({ readLater: value }) });
    toast(completed ? 'Marked as read. The bookmark is still in your library.' : value ? 'Added to Read later.' : 'Removed from Read later.');
    await loadBookmarks();
  } catch (error) { toast(error.message); }
}

function openDelete(bookmark) {
  state.dialogBookmark = bookmark; $('#deleteName').textContent = `“${bookmark.title}” and everything stored with it will be removed.`; $('#deleteDialog').showModal();
}
$('#deleteForm').addEventListener('submit', async event => {
  event.preventDefault();
  try { await api(`/api/bookmarks/${state.dialogBookmark.id}`, { method: 'DELETE' }); $('#deleteDialog').close(); toast('Bookmark permanently deleted from your library.'); await loadBookmarks(); }
  catch (error) { toast(error.message); }
});

async function openArchive(id) {
  try {
    const { archive } = await api(`/api/bookmarks/${id}/archive`);
    $('#archiveTitle').textContent = archive.title || 'Saved page'; $('#archiveDescription').textContent = archive.description || '';
    $('#archiveByline').textContent = [archive.author ? `By ${archive.author}` : '', archive.publishedAt ? `Originally published ${formatDate(archive.publishedAt)}` : ''].filter(Boolean).join(' · ');
    $('#archiveProvenance').textContent = `Captured ${formatDate(archive.capturedAt)} from ${archive.source || hostname(archive.originalUrl)}`;
    const image = $('#archiveImage'); if (archive.image) { image.src = archive.image; image.hidden = false; } else { image.hidden = true; image.removeAttribute('src'); }
    $('#archiveBody').replaceChildren(...(archive.paragraphs || []).map(value => { const p = document.createElement('p'); p.textContent = value; return p; }));
    $('#unavailableDialog').close(); $('#archiveDialog').showModal();
  } catch (error) { toast(error.message); }
}
function formatDate(value) { if (!value) return ''; const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); }
$('#archiveClose').addEventListener('click', () => $('#archiveDialog').close());

function openUnavailable(bookmark) { state.unavailableBookmark = bookmark; $('#unavailableDialog').showModal(); }
$('#unavailableClose').addEventListener('click', () => $('#unavailableDialog').close());
$('#unavailableArchive').addEventListener('click', () => openArchive(state.unavailableBookmark.id));

init().catch(error => { console.error(error); showLogin(); });
