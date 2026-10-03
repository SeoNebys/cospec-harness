const $ = (sel) => document.querySelector(sel);
let state = { q: '', tag: '' };

async function api(url, opts) {
  const res = await fetch(url, opts);
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadTags() {
  const tags = await api('/api/tags');
  const ul = $('#tagList');
  ul.innerHTML =
    `<li><button class="tag-chip ${state.tag === '' ? 'active' : ''}" data-tag="">All</button></li>` +
    tags
      .map(
        (t) =>
          `<li><button class="tag-chip ${state.tag === t.name ? 'active' : ''}" data-tag="${esc(t.name)}">${esc(t.name)}<span class="count">${t.count}</span></button></li>`
      )
      .join('');
  ul.querySelectorAll('.tag-chip').forEach((btn) => {
    btn.onclick = () => {
      state.tag = btn.dataset.tag;
      load();
    };
  });
}

async function load() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);
  const items = await api('/api/bookmarks?' + params.toString());
  const list = $('#list');
  $('#empty').hidden = items.length > 0;
  list.innerHTML = items
    .map(
      (b) => `
      <div class="card" data-id="${b.id}">
        <div class="row">
          <div>
            <a class="title" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title)}</a>
            <div class="url">${esc(b.url)}</div>
          </div>
          <div class="btns">
            <button class="edit">Edit</button>
            <button class="del">Delete</button>
          </div>
        </div>
        ${b.description ? `<div class="desc">${esc(b.description)}</div>` : ''}
        ${b.tags.length ? `<div class="tags">${b.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
      </div>`
    )
    .join('');
  list.querySelectorAll('.card').forEach((card) => {
    const id = card.dataset.id;
    const item = items.find((i) => String(i.id) === id);
    card.querySelector('.del').onclick = async () => {
      if (confirm('Delete this bookmark?')) {
        await api('/api/bookmarks/' + id, { method: 'DELETE' });
        refresh();
      }
    };
    card.querySelector('.edit').onclick = () => openModal(item);
  });
  await loadTags();
}

function refresh() {
  load();
}

// Modal handling
function openModal(item) {
  $('#modalTitle').textContent = item ? 'Edit bookmark' : 'Add bookmark';
  $('#bmId').value = item ? item.id : '';
  $('#url').value = item ? item.url : '';
  $('#title').value = item ? item.title : '';
  $('#description').value = item ? item.description : '';
  $('#tags').value = item ? item.tags.join(', ') : '';
  $('#modal').hidden = false;
  $('#url').focus();
}
function closeModal() {
  $('#modal').hidden = true;
  $('#form').reset();
}

$('#addBtn').onclick = () => openModal(null);
$('#cancelBtn').onclick = closeModal;
$('#modal').onclick = (e) => {
  if (e.target === $('#modal')) closeModal();
};

$('#form').onsubmit = async (e) => {
  e.preventDefault();
  const id = $('#bmId').value;
  const body = {
    url: $('#url').value,
    title: $('#title').value,
    description: $('#description').value,
    tags: $('#tags').value,
  };
  try {
    await api(id ? '/api/bookmarks/' + id : '/api/bookmarks', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    closeModal();
    refresh();
  } catch (err) {
    alert(err.message);
  }
};

let searchTimer;
$('#search').oninput = (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = e.target.value.trim();
    load();
  }, 200);
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
});

load().then(() => {
  document.body.setAttribute('data-harness-ready', 'true');
});
