const $ = selector => document.querySelector(selector);
const state = { bookmarks: [], view: 'all', tag: '', query: '', selectedTags: new Set(), editingId: null };
const els = {
  app: $('#app'), grid: $('#bookmarkGrid'), empty: $('#emptyState'), notice: $('#notice'), title: $('#viewTitle'), subtitle: $('#viewSubtitle'), result: $('#resultCount'),
  searchWrap: $('#searchWrap'), search: $('#search'), clearSearch: $('#clearSearch'), tagSection: $('#tagSection'), tagNav: $('#tagNav'), allCount: $('#allCount'), laterCount: $('#laterCount'), archiveCount: $('#archiveCount'),
  saveDialog: $('#saveDialog'), saveForm: $('#saveForm'), urlStep: $('#urlStep'), detailsStep: $('#detailsStep'), url: $('#bookmarkUrl'), urlMessage: $('#urlMessage'), fetchDetails: $('#fetchDetails'), fetchWarning: $('#fetchWarning'), retryFetch: $('#retryFetch'),
  id: $('#bookmarkId'), image: $('#bookmarkImage'), icon: $('#bookmarkIcon'), site: $('#bookmarkSite'), previewImage: $('#previewImage'), previewIcon: $('#previewIcon'), previewSite: $('#previewSite'), titleInput: $('#bookmarkTitle'), titleMessage: $('#titleMessage'), description: $('#bookmarkDescription'), notes: $('#bookmarkNotes'), readLater: $('#bookmarkReadLater'), tagChoices: $('#tagChoices'), newTag: $('#newTag'), addTag: $('#addTag'), saveHeading: $('#saveHeading'), saveOverline: $('#saveOverline'), saveChanges: $('#saveChanges'),
  detailsDialog: $('#detailsDialog'), duplicateNote: $('#duplicateNote'), detailSite: $('#detailSite'), detailTitle: $('#detailTitle'), detailImage: $('#detailImage'), detailDescription: $('#detailDescription'), detailTags: $('#detailTags'), noteBlock: $('#noteBlock'), detailNotes: $('#detailNotes'), editBookmark: $('#editBookmark'), openBookmark: $('#openBookmark'), toast: $('#toast')
};

async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body.error || 'Something went wrong.'); error.status = response.status; error.body = body; throw error; }
  return body;
}
function countLabel(number) { return `${number} ${number === 1 ? 'bookmark' : 'bookmarks'}`; }
function showToast(message) { els.toast.textContent = message; els.toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 1900); }
function tagsWithCounts() {
  const counts = new Map();
  state.bookmarks.filter(item => !item.archived).forEach(item => item.tags.forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
function searchMatch(item) {
  const words = state.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const fields = [item.title, item.description, item.notes].map(value => String(value || '').toLocaleLowerCase());
  return !words.length || words.every(word => fields.some(field => field.includes(word)));
}
function activeItems() {
  let items = state.bookmarks.filter(item => state.view === 'archive' ? item.archived : !item.archived);
  if (state.view === 'later') items = items.filter(item => item.readLater);
  if (state.view === 'tag') items = items.filter(item => item.tags.includes(state.tag));
  return items.filter(searchMatch);
}
function setView(view, tag = '') { state.view = view; state.tag = tag; state.query = ''; els.search.value = ''; render(); }

function element(name, className, text) { const node = document.createElement(name); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function siteIdentity(item) {
  const line = element('div', 'site-line');
  if (item.icon) { const img = element('img'); img.src = item.icon; img.alt = ''; img.addEventListener('error', () => img.replaceWith(element('span', 'site-fallback', (item.site || '?')[0].toUpperCase()))); line.append(img); }
  else line.append(element('span', 'site-fallback', (item.site || '?')[0].toUpperCase()));
  line.append(element('span', '', item.site || new URL(item.url).hostname)); return line;
}
function bookmarkCard(item) {
  const card = element('article', 'bookmark-card');
  const image = element('div', 'card-image', item.title);
  if (item.image) image.style.backgroundImage = `linear-gradient(0deg,rgba(20,30,25,.42),rgba(20,30,25,.05)),url("${CSS.escape(item.image)}")`;
  const body = element('div', 'card-body'); body.append(siteIdentity(item));
  const heading = element('h2'); const link = element('a', 'title-link', item.title); link.href = item.url; link.target = '_blank'; link.rel = 'noopener'; heading.append(link); body.append(heading);
  body.append(element('p', 'card-description', item.description || 'No description saved.'));
  const lower = state.query.trim().toLocaleLowerCase();
  if (lower && item.notes.toLocaleLowerCase().includes(lower) && !item.title.toLocaleLowerCase().includes(lower) && !item.description.toLocaleLowerCase().includes(lower)) body.append(element('p', 'note-match', `Matched in your note: “${item.notes.slice(0, 140)}${item.notes.length > 140 ? '…' : ''}”`));
  const tags = element('div', 'tag-row'); item.tags.forEach(tag => { const button = element('button', 'tag-pill', tag); button.onclick = () => setView('tag', tag); tags.append(button); }); body.append(tags);
  const actions = element('div', 'card-actions');
  const details = element('button', 'card-action', 'Details'); details.onclick = () => openDetails(item); actions.append(details);
  if (!item.archived) {
    const later = element('button', `card-action${item.readLater ? ' active' : ''}`, state.view === 'later' && item.readLater ? '✓ Mark as read' : item.readLater ? '✓ In Read later' : '+ Read later');
    later.onclick = () => updateBookmark(item.id, { readLater: !item.readLater }, item.readLater ? 'Marked as read — still in your collection' : 'Added to Read later'); actions.append(later);
    const archive = element('button', 'card-action archive', 'Archive'); archive.onclick = () => updateBookmark(item.id, { archived: true }, 'Moved to Archive'); actions.append(archive);
  } else { const restore = element('button', 'card-action active', 'Restore to collection'); restore.onclick = () => updateBookmark(item.id, { archived: false }, 'Restored to your collection'); actions.append(restore); }
  body.append(actions); card.append(image, body); return card;
}
function emptyContent(items) {
  const hasBookmarks = state.bookmarks.length > 0;
  if (!hasBookmarks) return { icon: '◇', title: 'Your collection starts here', text: 'Save your first page and we’ll gather its useful details for you.', button: 'Save your first bookmark', action: openNew };
  if (state.query) return { icon: '⌕', title: 'No bookmarks found', text: 'Try a different word or phrase. Your collection is still intact.', button: 'Clear search', action: () => { state.query = ''; els.search.value = ''; render(); } };
  if (state.view === 'later') return { icon: '✓', title: 'You’re all caught up', text: 'There’s nothing waiting in Read later. Your bookmarks remain in the main collection.', button: 'Browse all bookmarks', action: () => setView('all') };
  if (state.view === 'archive') return { icon: '◇', title: 'Archive is empty', text: 'Bookmarks you tuck away will remain safe here.', button: 'Browse all bookmarks', action: () => setView('all') };
  if (state.view === 'tag') return { icon: '#', title: `No bookmarks tagged “${state.tag}”`, text: 'Choose another tag or return to the full collection.', button: 'Browse all bookmarks', action: () => setView('all') };
  return { icon: '◇', title: 'Nothing here yet', text: '', button: 'Browse all bookmarks', action: () => setView('all') };
}
function renderEmpty(items) {
  const content = emptyContent(items); els.empty.replaceChildren();
  const wrap = element('div'); wrap.append(element('div', 'empty-icon', content.icon), element('h2', '', content.title), element('p', '', content.text));
  const button = element('button', 'button primary', content.button); button.onclick = content.action; wrap.append(button); els.empty.append(wrap); els.empty.hidden = false;
}
function render() {
  const all = state.bookmarks.filter(item => !item.archived), later = all.filter(item => item.readLater), archive = state.bookmarks.filter(item => item.archived);
  els.allCount.textContent = all.length; els.laterCount.textContent = later.length; els.archiveCount.textContent = archive.length;
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
  const tagCounts = tagsWithCounts(); els.tagSection.hidden = !tagCounts.length; els.tagNav.replaceChildren();
  tagCounts.forEach(([tag, count]) => { const button = element('button', `nav-item${state.view === 'tag' && state.tag === tag ? ' active' : ''}`); button.append(element('span', '', tag), element('span', '', count)); button.onclick = () => setView('tag', tag); els.tagNav.append(button); });
  const headings = { all: ['Your bookmarks', 'The things you meant to keep.'], later: ['Read later', 'Everything waiting for you.'], archive: ['Archive', 'Tucked away, never lost.'], tag: [state.tag, `Bookmarks tagged “${state.tag}”.`] };
  [els.title.textContent, els.subtitle.textContent] = headings[state.view];
  const baseCount = state.view === 'all' ? all.length : state.view === 'later' ? later.length : state.view === 'archive' ? archive.length : all.filter(item => item.tags.includes(state.tag)).length;
  els.searchWrap.hidden = !state.bookmarks.length; els.clearSearch.hidden = !state.query; const items = activeItems(); els.result.textContent = countLabel(items.length || (state.query ? 0 : baseCount));
  els.grid.replaceChildren(...items.map(bookmarkCard)); els.grid.hidden = !items.length; els.empty.hidden = true; if (!items.length) renderEmpty(items);
  if (!els.app.hasAttribute('data-harness-ready')) els.app.setAttribute('data-harness-ready', 'true');
}
async function load() { const data = await request('/api/bookmarks'); state.bookmarks = data.bookmarks; render(); }
async function updateBookmark(id, patch, message) { const { bookmark } = await request(`/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); state.bookmarks = state.bookmarks.map(item => item.id === id ? bookmark : item); showToast(message); render(); }

function resetSave() {
  state.editingId = null; state.selectedTags = new Set(); els.saveForm.reset(); els.id.value = ''; els.image.value = ''; els.icon.value = ''; els.site.value = ''; els.urlStep.hidden = false; els.detailsStep.hidden = true; els.fetchWarning.hidden = true; els.retryFetch.hidden = true; els.urlMessage.textContent = 'Paste a link and we’ll fill in the useful details.'; els.urlMessage.classList.remove('error'); els.saveOverline.textContent = 'New bookmark'; els.saveHeading.textContent = 'Save a bookmark'; els.saveChanges.textContent = 'Save bookmark';
}
function openNew() { resetSave(); els.saveDialog.showModal(); setTimeout(() => els.url.focus(), 30); }
function allKnownTags() { return tagsWithCounts().map(([tag]) => tag); }
function renderTagChoices() {
  els.tagChoices.replaceChildren(); const tags = [...new Set([...allKnownTags(), ...state.selectedTags])].sort();
  tags.forEach(tag => { const label = element('label', 'tag-choice'); const check = element('input'); check.type = 'checkbox'; check.checked = state.selectedTags.has(tag); check.onchange = () => check.checked ? state.selectedTags.add(tag) : state.selectedTags.delete(tag); label.append(check, document.createTextNode(tag)); els.tagChoices.append(label); });
  if (!tags.length) els.tagChoices.append(element('p', 'helper', 'No tags yet. Create your first one below.'));
}
function fillDetails(data, manual = false) {
  els.urlStep.hidden = true; els.detailsStep.hidden = false; els.url.value = data.url || els.url.value; els.titleInput.value = data.title || ''; els.description.value = data.description || ''; els.image.value = data.image || ''; els.icon.value = data.icon || ''; els.site.value = data.site || new URL(els.url.value).hostname.replace(/^www\./, '');
  els.previewSite.textContent = els.site.value; els.previewIcon.src = els.icon.value; els.previewIcon.hidden = !els.icon.value; els.previewImage.style.backgroundImage = els.image.value ? `linear-gradient(0deg,rgba(20,30,25,.35),rgba(20,30,25,.05)),url("${CSS.escape(els.image.value)}")` : ''; els.previewImage.firstElementChild.textContent = data.title || 'Page preview';
  els.fetchWarning.hidden = !manual; els.retryFetch.hidden = !manual; els.saveChanges.disabled = !els.titleInput.value.trim(); renderTagChoices(); setTimeout(() => els.titleInput.focus(), 30);
}
async function fetchDetails() {
  const value = els.url.value.trim(); if (!value) { els.urlMessage.textContent = 'Enter a web address, like https://example.com/page'; els.urlMessage.classList.add('error'); els.url.focus(); return; }
  els.fetchDetails.disabled = true; els.fetchDetails.textContent = 'Getting details…'; els.urlMessage.classList.remove('error');
  try {
    const result = await request('/api/metadata', { method: 'POST', body: JSON.stringify({ url: value }) });
    if (result.duplicate) { els.saveDialog.close(); openDetails(result.bookmark, true); return; }
    fillDetails(result.metadata);
  } catch (error) {
    if (error.status === 400) { els.urlMessage.textContent = error.message; els.urlMessage.classList.add('error'); els.url.focus(); els.url.select(); }
    else if (error.body?.canEnterManually) fillDetails({ url: error.body.url }, true);
    else { els.urlMessage.textContent = error.message; els.urlMessage.classList.add('error'); }
  } finally { els.fetchDetails.disabled = false; els.fetchDetails.textContent = 'Get details'; }
}
function addNewTag() { const tag = els.newTag.value.trim().replace(/\s+/g, ' ').toLocaleLowerCase(); if (!tag) return; state.selectedTags.add(tag); els.newTag.value = ''; renderTagChoices(); }
async function saveBookmark(event) {
  event.preventDefault(); const title = els.titleInput.value.trim(); if (!title) { els.titleMessage.hidden = false; els.titleInput.focus(); return; } els.titleMessage.hidden = true;
  const payload = { url: els.url.value, title, description: els.description.value, image: els.image.value, icon: els.icon.value, site: els.site.value, notes: els.notes.value, tags: [...state.selectedTags], readLater: els.readLater.checked };
  els.saveChanges.disabled = true;
  try {
    if (state.editingId) { const { bookmark } = await request(`/api/bookmarks/${state.editingId}`, { method: 'PATCH', body: JSON.stringify(payload) }); state.bookmarks = state.bookmarks.map(item => item.id === bookmark.id ? bookmark : item); showToast('Bookmark updated'); }
    else { const result = await request('/api/bookmarks', { method: 'POST', body: JSON.stringify(payload) }); if (result.duplicate) { els.saveDialog.close(); openDetails(result.bookmark, true); return; } state.bookmarks.unshift(result.bookmark); showToast('Bookmark saved'); }
    els.saveDialog.close(); state.view = 'all'; state.query = ''; render();
  } catch (error) { showToast(error.message); } finally { els.saveChanges.disabled = false; }
}
function openEdit(item) {
  els.detailsDialog.close(); resetSave(); state.editingId = item.id; state.selectedTags = new Set(item.tags); els.url.value = item.url; els.notes.value = item.notes; els.readLater.checked = item.readLater; els.id.value = item.id; els.saveOverline.textContent = 'Edit bookmark'; els.saveHeading.textContent = item.title; els.saveChanges.textContent = 'Save changes'; fillDetails(item); els.saveDialog.showModal();
}
function openDetails(item, duplicate = false) {
  els.duplicateNote.hidden = !duplicate; els.detailSite.textContent = item.site || new URL(item.url).hostname; els.detailTitle.textContent = item.title; els.detailDescription.textContent = item.description || 'No description saved.';
  els.detailImage.hidden = !item.image; els.detailImage.src = item.image || ''; els.detailTags.replaceChildren(...item.tags.map(tag => element('span', 'tag-pill', tag))); els.noteBlock.hidden = !item.notes; els.detailNotes.textContent = item.notes; els.openBookmark.href = item.url; els.editBookmark.onclick = () => openEdit(item); els.detailsDialog.showModal();
}

$('#newBookmark').onclick = openNew; $('#brand').onclick = () => setView('all'); $('#closeSave').onclick = () => els.saveDialog.close(); $('#closeDetails').onclick = () => els.detailsDialog.close();
document.querySelectorAll('#mainNav .nav-item').forEach(button => button.onclick = () => setView(button.dataset.view));
els.fetchDetails.onclick = fetchDetails; els.retryFetch.onclick = () => { els.detailsStep.hidden = true; els.urlStep.hidden = false; fetchDetails(); }; els.addTag.onclick = addNewTag; els.newTag.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); addNewTag(); } }; els.saveForm.onsubmit = saveBookmark;
els.titleInput.oninput = () => { const hasTitle = Boolean(els.titleInput.value.trim()); els.saveChanges.disabled = !hasTitle; if (hasTitle) els.titleMessage.hidden = true; };
els.search.oninput = () => { state.query = els.search.value; render(); }; els.clearSearch.onclick = () => { state.query = ''; els.search.value = ''; render(); els.search.focus(); };
load().catch(error => { els.empty.hidden = false; els.empty.textContent = `Keepwell could not load: ${error.message}`; els.app.setAttribute('data-harness-ready', 'true'); });
