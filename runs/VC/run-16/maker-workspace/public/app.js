const state = {
  q: '',
  tag: null,
  favorite: false,
};

const $ = (sel) => document.querySelector(sel);

// --- API --------------------------------------------------------------------
async function api(path, opts) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    let msg = 'Request failed';
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function faviconFor(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return '';
  }
}

// --- Rendering --------------------------------------------------------------
async function refresh() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);
  if (state.favorite) params.set('favorite', 'true');
  const [bookmarks, tags] = await Promise.all([
    api('/api/bookmarks?' + params.toString()),
    api('/api/tags'),
  ]);
  renderList(bookmarks);
  renderTags(tags);
  renderActiveTag();
  markReady();
}

function renderList(items) {
  const list = $('#list');
  const empty = $('#empty');
  if (!items.length) {
    list.innerHTML = '';
    // Show the friendly empty state only when nothing is filtered
    empty.hidden = !!(state.q || state.tag || state.favorite);
    if (!empty.hidden) return;
    list.innerHTML = '<p class="empty">No bookmarks match your filters.</p>';
    return;
  }
  empty.hidden = true;
  list.innerHTML = items.map(cardHtml).join('');
}

function cardHtml(b) {
  const fav = faviconFor(b.url);
  const tags = b.tags.map((t) =>
    `<span class="chip" data-tag="${esc(t)}">#${esc(t)}</span>`).join('');
  return `
    <article class="card" data-id="${b.id}">
      <div class="card-head">
        ${fav ? `<img class="favicon" src="${esc(fav)}" alt="" onerror="this.style.visibility='hidden'"/>` : '<span class="favicon"></span>'}
        <h3 class="card-title"><a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${esc(b.title)}</a></h3>
        <button class="star-btn ${b.favorite ? 'on' : ''}" data-act="fav" title="Toggle favorite">★</button>
      </div>
      <div class="card-url">${esc(b.url)}</div>
      ${b.description ? `<div class="card-desc">${esc(b.description)}</div>` : ''}
      ${tags ? `<div class="card-tags">${tags}</div>` : ''}
      <div class="card-actions">
        <button data-act="edit">Edit</button>
        <button class="del" data-act="del">Delete</button>
      </div>
    </article>`;
}

function renderTags(tags) {
  const el = $('#tag-list');
  if (!tags.length) { el.innerHTML = '<span class="chip">No tags yet</span>'; return; }
  el.innerHTML = tags.map((t) =>
    `<span class="chip ${state.tag === t.name ? 'active' : ''}" data-tag="${esc(t.name)}">#${esc(t.name)} <span class="count">${t.count}</span></span>`
  ).join('');
}

function renderActiveTag() {
  const bar = $('#active-tag-bar');
  if (state.tag) {
    bar.hidden = false;
    $('#active-tag').textContent = '#' + state.tag;
  } else {
    bar.hidden = true;
  }
}

let readyMarked = false;
function markReady() {
  if (readyMarked) return;
  document.body.setAttribute('data-harness-ready', 'true');
  readyMarked = true;
}

// --- Modal ------------------------------------------------------------------
function openModal(bookmark) {
  $('#modal-title').textContent = bookmark ? 'Edit bookmark' : 'New bookmark';
  $('#edit-id').value = bookmark ? bookmark.id : '';
  $('#f-url').value = bookmark ? bookmark.url : '';
  $('#f-title').value = bookmark ? bookmark.title : '';
  $('#f-description').value = bookmark ? bookmark.description : '';
  $('#f-tags').value = bookmark ? bookmark.tags.join(', ') : '';
  $('#f-favorite').checked = bookmark ? bookmark.favorite : false;
  $('#form-error').hidden = true;
  $('#modal').hidden = false;
  $('#f-url').focus();
}
function closeModal() { $('#modal').hidden = true; }

// --- Events -----------------------------------------------------------------
let searchTimer;
$('#search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const v = e.target.value.trim();
  searchTimer = setTimeout(() => { state.q = v; refresh(); }, 200);
});

$('#new-btn').addEventListener('click', () => openModal(null));
$('#cancel-btn').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

$('.filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter');
  if (!btn) return;
  document.querySelectorAll('.filter').forEach((f) => f.classList.remove('active'));
  btn.classList.add('active');
  state.favorite = btn.dataset.filter === 'favorites';
  refresh();
});

$('#tag-list').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-tag]');
  if (!chip) return;
  const tag = chip.dataset.tag;
  state.tag = state.tag === tag ? null : tag;
  refresh();
});

$('#clear-tag').addEventListener('click', () => { state.tag = null; refresh(); });

$('#list').addEventListener('click', async (e) => {
  const tagChip = e.target.closest('[data-tag]');
  if (tagChip) { state.tag = tagChip.dataset.tag; refresh(); return; }

  const card = e.target.closest('.card');
  if (!card) return;
  const id = Number(card.dataset.id);
  const act = e.target.dataset.act;
  if (!act) return;

  if (act === 'del') {
    if (!confirm('Delete this bookmark?')) return;
    await api(`/api/bookmarks/${id}`, { method: 'DELETE' });
    refresh();
  } else if (act === 'fav') {
    const on = e.target.classList.contains('on');
    await api(`/api/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify({ favorite: !on }) });
    refresh();
  } else if (act === 'edit') {
    const items = await api('/api/bookmarks');
    const b = items.find((x) => x.id === id);
    if (b) openModal(b);
  }
});

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#edit-id').value;
  const payload = {
    url: $('#f-url').value,
    title: $('#f-title').value,
    description: $('#f-description').value,
    tags: $('#f-tags').value,
    favorite: $('#f-favorite').checked,
  };
  try {
    if (id) {
      await api(`/api/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/bookmarks', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeModal();
    refresh();
  } catch (err) {
    const box = $('#form-error');
    box.textContent = err.message;
    box.hidden = false;
  }
});

refresh();
