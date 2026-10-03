import { createNotesEditor } from '/notes-editor.js';

// ---------- tiny DOM helpers ----------
const $ = (sel) => document.querySelector(sel);
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}
async function api(method, path, body, isText = false) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    if (isText) { opts.headers['Content-Type'] = 'text/html'; opts.body = body; }
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(`/api${path}`, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- state ----------
const state = {
  view: 'all', q: '', sort: 'date_added_desc', tag: null, filterId: null, filterName: null,
  selection: new Set(), selectAllMatching: false, prefs: null, items: [],
};

// ---------- preferences ----------
async function loadPreferences() {
  state.prefs = await api('GET', '/preferences');
  applyPreferences();
  state.sort = state.prefs.default_sort;
  $('#sort').value = state.sort;
}
function applyPreferences() {
  document.body.dataset.density = state.prefs.density;
  document.body.dataset.textSize = state.prefs.text_size;
}

// ---------- tags & filters (sidebar) ----------
async function loadTags() {
  const tags = await api('GET', '/tags');
  const list = $('#tag-list');
  list.replaceChildren();
  if (!tags.length) { list.appendChild(el('li', { class: 'hint', text: 'No tags yet' })); return; }
  for (const t of tags) {
    list.appendChild(el('li', {},
      el('button', { text: `#${t.name}`, onclick: () => { state.tag = t.name; state.filterId = null; refresh(); } }),
      el('span', { class: 'count', text: String(t.count) }),
    ));
  }
}
async function loadFilters() {
  const filters = await api('GET', '/filters');
  const list = $('#filter-list');
  list.replaceChildren();
  if (!filters.length) { list.appendChild(el('li', { class: 'hint', text: 'None saved' })); return; }
  for (const f of filters) {
    list.appendChild(el('li', {},
      el('button', { class: 'apply', text: f.name, onclick: () => applyFilter(f) }),
      el('button', { class: 'del', text: '✕', title: 'Delete filter', onclick: async () => { await api('DELETE', `/filters/${f.id}`); loadFilters(); } }),
    ));
  }
}
function applyFilter(f) {
  state.filterId = f.id; state.filterName = f.name; state.tag = null; state.q = f.query || '';
  $('#search').value = state.q; refresh();
}

// ---------- list ----------
function buildListParams() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.tag) p.set('tag', state.tag);
  if (state.filterId) p.set('filterId', state.filterId);
  p.set('view', state.view);
  p.set('sort', state.sort);
  return p;
}
async function loadList() {
  const data = await api('GET', `/bookmarks?${buildListParams().toString()}`);
  state.items = data.items;
  renderList();
}
function renderList() {
  const list = $('#bookmark-list');
  const empty = $('#empty-state');
  list.replaceChildren();

  if (!state.items.length) {
    empty.hidden = false;
    empty.textContent = emptyMessage();
    updateBulkBar();
    return;
  }
  empty.hidden = true;
  for (const b of state.items) list.appendChild(renderCard(b));
  updateBulkBar();
}
function emptyMessage() {
  if (state.q || state.tag || state.filterId) return 'No bookmarks match your search or filter.';
  if (state.view === 'unread') return 'Nothing to read later — your unread list is empty.';
  if (state.view === 'archived') return 'No archived bookmarks.';
  return 'No bookmarks yet. Paste a link above to save your first one.';
}

function renderCard(b) {
  const checkbox = el('input', { type: 'checkbox', class: 'sel',
    onchange: (e) => { e.target.checked ? state.selection.add(b.id) : state.selection.delete(b.id); state.selectAllMatching = false; updateBulkBar(); } });
  checkbox.checked = state.selection.has(b.id);

  const favicon = b.favicon_url
    ? el('img', { class: 'favicon', src: b.favicon_url, alt: '', onerror: (e) => { e.target.style.visibility = 'hidden'; } })
    : el('div', { class: 'favicon' });

  const title = el('a', { class: 'title', href: b.url, target: '_blank', rel: 'noopener noreferrer', text: b.title || b.url });
  const urlLink = el('a', { class: 'url', href: b.url, target: '_blank', rel: 'noopener noreferrer', text: b.url });

  const chips = el('div', { class: 'chips' },
    (b.tags || []).map((t) => el('button', { class: 'chip', text: `#${t}`, onclick: () => { state.tag = t; state.filterId = null; refresh(); } })));

  const body = el('div', { class: 'body' },
    title, urlLink,
    b.description ? el('p', { class: 'desc', text: b.description }) : null,
    chips,
  );

  // meta badges
  const badges = el('div', { class: 'actions' });
  if (!b.is_read) badges.appendChild(el('span', { class: 'badge unread', text: 'Unread' }));
  badges.appendChild(el('span', { class: `badge offline-${b.offline_status}`, text:
    b.offline_status === 'available' ? 'Offline ✓' : b.offline_status === 'unavailable' ? 'Offline ✕' : 'Offline…' }));
  if (b.ia_status === 'saved') badges.appendChild(el('span', { class: 'badge ia-saved', text: 'Archived ↗' }));

  const actions = el('div', { class: 'actions' },
    el('button', { text: b.is_read ? 'Mark unread' : 'Mark read', onclick: async () => { await api('PATCH', `/bookmarks/${b.id}`, { is_read: !b.is_read }); refresh(); } }),
    b.offline_status === 'available'
      ? el('a', { class: 'btn', href: `/api/bookmarks/${b.id}/snapshot`, target: '_blank', rel: 'noopener', text: 'View copy',
          style: 'display:inline-block;border:1px solid var(--line);border-radius:8px;padding:0.2rem 0.45rem;font-size:0.85em;text-decoration:none;color:inherit;' })
      : null,
    el('button', { text: 'Edit', onclick: () => openEditModal(b) }),
    b.is_archived
      ? el('button', { text: 'Restore', onclick: async () => { await api('PATCH', `/bookmarks/${b.id}`, { is_archived: false }); refresh(); } })
      : el('button', { text: 'Archive', onclick: async () => { await api('PATCH', `/bookmarks/${b.id}`, { is_archived: true }); refresh(); } }),
    el('button', { class: 'danger', text: 'Delete', onclick: async () => { if (confirm('Delete this bookmark? This cannot be undone.')) { await api('DELETE', `/bookmarks/${b.id}`); refresh(); } } }),
  );

  const meta = el('div', { class: 'meta' }, badges, actions);
  return el('li', {}, el('div', { class: 'card' }, checkbox, favicon, body, meta));
}

// ---------- bulk actions ----------
function updateBulkBar() {
  const bar = $('#bulk-bar');
  const count = state.selection.size;
  const anySelected = count > 0 || state.selectAllMatching;
  bar.hidden = !anySelected && state.items.length === 0;
  bar.hidden = state.items.length === 0;
  $('#sel-count').textContent = state.selectAllMatching
    ? 'All matching selected'
    : `${count} selected`;
  const matchBtn = $('#bulk-select-matching');
  matchBtn.textContent = state.selectAllMatching ? 'Clear selection' : 'Select all matching';
  $('#select-all').checked = state.selectAllMatching || (state.items.length > 0 && count === state.items.length);
}
async function runBulk(action) {
  let tags;
  if (action === 'add_tags' || action === 'remove_tags') {
    const input = prompt(action === 'add_tags' ? 'Tag(s) to add (comma-separated):' : 'Tag(s) to remove (comma-separated):');
    if (!input) return;
    tags = input.split(',').map((t) => t.trim()).filter(Boolean);
  }
  if (action === 'delete' && !confirm('Delete all selected bookmarks? This cannot be undone.')) return;

  const target = state.selectAllMatching
    ? { match: { q: state.q, tag: state.tag, filterId: state.filterId, view: state.view } }
    : { ids: [...state.selection] };
  if (!state.selectAllMatching && state.selection.size === 0) { alert('Select some bookmarks first.'); return; }

  const r = await api('POST', '/bookmarks/bulk', { target, action, tags });
  state.selection.clear(); state.selectAllMatching = false;
  await refresh();
  flash(`${r.affected} bookmark(s) updated.`);
}

// ---------- add / preview / confirm ----------
async function startAdd(e) {
  e.preventDefault();
  const url = $('#add-url').value.trim();
  if (!url) return;
  let preview;
  try { preview = await api('POST', '/bookmarks/preview', { url }); }
  catch (err) { alert(err.message); return; }
  if (preview.duplicate) {
    flash('You already saved this — opening it for editing.');
    $('#add-url').value = '';
    openEditModal(preview.bookmark);
    return;
  }
  openReviewModal(preview);
}

function tagInput(initial = []) {
  const chips = el('div', { class: 'tag-input-chips' });
  const tags = [...initial];
  const input = el('input', { type: 'text', placeholder: 'Add a tag and press Enter' });
  const suggestBox = el('ul', { class: 'suggest-list', hidden: true });
  const wrap = el('div', { class: 'suggest' }, input, suggestBox);

  function renderChips() {
    chips.replaceChildren(...tags.map((t) =>
      el('span', { class: 'chip' }, `#${t}`, el('button', { type: 'button', text: '✕', onclick: () => { tags.splice(tags.indexOf(t), 1); renderChips(); } }))));
  }
  function addTag(t) { t = t.trim(); if (t && !tags.includes(t)) { tags.push(t); renderChips(); } input.value = ''; suggestBox.hidden = true; }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(input.value); } });
  input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (!q) { suggestBox.hidden = true; return; }
    const sugg = await api('GET', `/tags/suggest?q=${encodeURIComponent(q)}`);
    const filtered = sugg.filter((s) => !tags.includes(s));
    suggestBox.replaceChildren(...filtered.map((s) => el('li', { text: `#${s}`, onclick: () => addTag(s) })));
    suggestBox.hidden = filtered.length === 0;
  });
  return { element: el('div', {}, chips, wrap), getTags: () => tags };
}

function openReviewModal(preview) {
  const titleInput = el('input', { type: 'text', value: preview.title || '' });
  const descInput = el('textarea', { rows: '3' }); descInput.value = preview.description || '';
  const tags = tagInput([]);
  const thumb = preview.preview_image_url
    ? el('img', { class: 'preview-thumb', src: preview.preview_image_url, alt: '', onerror: (e) => e.target.remove() }) : null;

  const modal = el('div', { class: 'modal' },
    el('h3', { text: 'Save bookmark' }),
    el('div', { class: 'hint', text: preview.normalized_url }),
    preview.fallback ? el('div', { class: 'fallback-note', text: 'We could not fetch page details, so we filled in a best guess. Edit as needed.' }) : null,
    el('label', { text: 'Title' }), titleInput,
    el('label', { text: 'Description' }), descInput,
    thumb,
    el('label', { text: 'Tags' }), tags.element,
    el('div', { class: 'row' },
      el('button', { text: 'Cancel', onclick: closeModal }),
      el('button', { class: 'primary', text: 'Save', style: 'border-color:var(--accent);color:var(--accent)', onclick: async () => {
        await api('POST', '/bookmarks', {
          url: preview.url, title: titleInput.value, description: descInput.value,
          favicon_url: preview.favicon_url, preview_image_url: preview.preview_image_url,
          tags: tags.getTags(),
        });
        $('#add-url').value = '';
        closeModal();
        await refresh();
        flash('Saved. Making an offline copy in the background…');
      } }),
    ),
  );
  showModal(modal);
}

function openEditModal(b) {
  const titleInput = el('input', { type: 'text', value: b.title || '' });
  const descInput = el('textarea', { rows: '2' }); descInput.value = b.description || '';
  const urlInput = el('input', { type: 'text', value: b.url || '' });
  const tags = tagInput(b.tags || []);
  const notes = createNotesEditor(b.notes_html || '');

  const preserveBtn = el('button', { text: b.ia_status === 'saved' ? 'Preserved to Internet Archive ✓' : 'Preserve to Internet Archive', onclick: async () => {
    preserveBtn.textContent = 'Submitting to Internet Archive…';
    await api('POST', `/bookmarks/${b.id}/preserve`);
    pollIa(b.id, preserveBtn);
  } });

  const modal = el('div', { class: 'modal' },
    el('h3', { text: 'Edit bookmark' }),
    el('label', { text: 'Title' }), titleInput,
    el('label', { text: 'Address' }), urlInput,
    el('label', { text: 'Description' }), descInput,
    el('label', { text: 'Tags' }), tags.element,
    el('label', { text: 'Notes' }), notes.element,
    el('label', { text: 'Preservation' }),
    el('div', {}, preserveBtn,
      b.offline_status === 'available' ? el('a', { href: `/api/bookmarks/${b.id}/snapshot`, target: '_blank', rel: 'noopener', text: '  View offline copy' }) : null),
    el('div', { class: 'row' },
      el('button', { text: 'Cancel', onclick: closeModal }),
      el('button', { class: 'primary', text: 'Save changes', style: 'border-color:var(--accent);color:var(--accent)', onclick: async () => {
        try {
          await api('PATCH', `/bookmarks/${b.id}`, {
            title: titleInput.value, url: urlInput.value, description: descInput.value,
            notes_html: notes.getHTML(), tags: tags.getTags(),
          });
          closeModal(); await refresh();
        } catch (err) { alert(err.message); }
      } }),
    ),
  );
  showModal(modal);
}
async function pollIa(id, btn, tries = 0) {
  const s = await api('GET', `/bookmarks/${id}/preserve`);
  if (s.ia_status === 'saved') { btn.textContent = 'Preserved to Internet Archive ✓'; refresh(); return; }
  if (s.ia_status === 'failed') { btn.textContent = 'Internet Archive failed — retry'; return; }
  if (tries < 30) setTimeout(() => pollIa(id, btn, tries + 1), 3000);
}

// ---------- save filter modal ----------
function openSaveFilterModal() {
  const nameInput = el('input', { type: 'text', placeholder: 'Filter name' });
  const includeInput = el('input', { type: 'text', placeholder: 'tags to include (comma-separated)' });
  const excludeInput = el('input', { type: 'text', placeholder: 'tags to exclude (comma-separated)' });
  const parse = (s) => s.split(',').map((t) => t.trim()).filter(Boolean);
  const modal = el('div', { class: 'modal' },
    el('h3', { text: 'Save current search as a filter' }),
    el('div', { class: 'hint', text: `Search: ${state.q || '(none)'}` }),
    el('label', { text: 'Name' }), nameInput,
    el('label', { text: 'Include tags' }), includeInput,
    el('label', { text: 'Exclude tags' }), excludeInput,
    el('div', { class: 'row' },
      el('button', { text: 'Cancel', onclick: closeModal }),
      el('button', { text: 'Save filter', style: 'border-color:var(--accent);color:var(--accent)', onclick: async () => {
        if (!nameInput.value.trim()) { alert('Please name the filter.'); return; }
        await api('POST', '/filters', { name: nameInput.value.trim(), query: state.q,
          include_tags: parse(includeInput.value), exclude_tags: parse(excludeInput.value) });
        closeModal(); loadFilters();
      } }),
    ),
  );
  showModal(modal);
}

// ---------- preferences modal ----------
function openPrefsModal() {
  const sortSel = el('select', {},
    ...[['date_added_desc', 'Newest first'], ['date_added_asc', 'Oldest first'], ['title_asc', 'Title A–Z'], ['title_desc', 'Title Z–A']]
      .map(([v, l]) => el('option', { value: v, ...(state.prefs.default_sort === v ? { selected: true } : {}) }, l)));
  const densSel = el('select', {},
    ...[['comfortable', 'Comfortable'], ['compact', 'Compact']].map(([v, l]) => el('option', { value: v, ...(state.prefs.density === v ? { selected: true } : {}) }, l)));
  const sizeSel = el('select', {},
    ...[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']].map(([v, l]) => el('option', { value: v, ...(state.prefs.text_size === v ? { selected: true } : {}) }, l)));
  const modal = el('div', { class: 'modal' },
    el('h3', { text: 'Display preferences' }),
    el('label', { text: 'Default sort' }), sortSel,
    el('label', { text: 'Density (how much is shown)' }), densSel,
    el('label', { text: 'Text size' }), sizeSel,
    el('div', { class: 'row' },
      el('button', { text: 'Cancel', onclick: closeModal }),
      el('button', { text: 'Save', style: 'border-color:var(--accent);color:var(--accent)', onclick: async () => {
        state.prefs = await api('PUT', '/preferences', { default_sort: sortSel.value, density: densSel.value, text_size: sizeSel.value });
        applyPreferences();
        state.sort = state.prefs.default_sort; $('#sort').value = state.sort;
        closeModal(); await refresh();
      } }),
    ),
  );
  showModal(modal);
}

// ---------- import ----------
async function doImport(file) {
  const text = await file.text();
  const r = await api('POST', '/import', text, true);
  flash(`Imported ${r.imported}, skipped ${r.skipped}, duplicates ${r.duplicates}.`);
  await refresh(); loadTags();
}

// ---------- modal + flash helpers ----------
function showModal(node) { const root = $('#modal-root'); root.replaceChildren(node); root.hidden = false; }
function closeModal() { const root = $('#modal-root'); root.replaceChildren(); root.hidden = true; }
$('#modal-root').addEventListener('click', (e) => { if (e.target.id === 'modal-root') closeModal(); });

let flashTimer;
function flash(msg) {
  let f = $('#flash');
  if (!f) { f = el('div', { id: 'flash', style: 'position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);background:#1c2330;color:#fff;padding:0.6rem 1rem;border-radius:8px;z-index:30;' }); document.body.appendChild(f); }
  f.textContent = msg; f.style.display = 'block';
  clearTimeout(flashTimer); flashTimer = setTimeout(() => { f.style.display = 'none'; }, 2500);
}

// ---------- active filter banner ----------
function renderActiveFilter() {
  const banner = $('#active-filter');
  let label = null;
  if (state.filterId) label = `Filter: ${state.filterName}`;
  else if (state.tag) label = `Tag: #${state.tag}`;
  if (!label) { banner.hidden = true; return; }
  banner.hidden = false;
  banner.replaceChildren(el('span', { text: label }),
    el('button', { text: 'Clear', onclick: () => { state.tag = null; state.filterId = null; state.filterName = null; state.q = ''; $('#search').value = ''; refresh(); } }));
}

// ---------- refresh ----------
async function refresh() {
  renderActiveFilter();
  await loadList();
  await loadTags();
}

// ---------- events ----------
$('#add-form').addEventListener('submit', startAdd);
$('#search').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); state.filterId = null; refresh(); }, 250));
$('#sort').addEventListener('change', (e) => { state.sort = e.target.value; loadList(); });
document.querySelectorAll('.view-tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.view-tab').forEach((t) => t.classList.remove('active'));
  tab.classList.add('active'); state.view = tab.dataset.view; state.selection.clear(); state.selectAllMatching = false; refresh();
}));
$('#select-all').addEventListener('change', (e) => {
  if (e.target.checked) state.items.forEach((b) => state.selection.add(b.id));
  else { state.selection.clear(); state.selectAllMatching = false; }
  renderList();
});
$('#bulk-select-matching').addEventListener('click', () => {
  state.selectAllMatching = !state.selectAllMatching;
  if (!state.selectAllMatching) state.selection.clear();
  updateBulkBar();
});
document.querySelectorAll('[data-bulk]').forEach((btn) => btn.addEventListener('click', () => runBulk(btn.dataset.bulk)));
$('#btn-prefs').addEventListener('click', openPrefsModal);
$('#btn-save-filter').addEventListener('click', openSaveFilterModal);
$('#btn-import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', (e) => { if (e.target.files[0]) doImport(e.target.files[0]); e.target.value = ''; });

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ---------- boot ----------
(async function boot() {
  try {
    await loadPreferences();
    await loadFilters();
    await refresh();
  } catch (err) {
    $('#empty-state').hidden = false;
    $('#empty-state').textContent = `Could not load: ${err.message}`;
  } finally {
    document.body.setAttribute('data-harness-ready', 'true');
  }
})();
