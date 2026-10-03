import { api } from '../api.js';

export async function renderSavedSearches(container, state, navigate) {
  container.innerHTML = '<h2>Saved searches</h2><p class="loading">Loading…</p>';
  const { items } = await api.savedSearches();
  container.innerHTML = '<h2>Saved searches</h2>';
  document.querySelector('#app')?.setAttribute('data-harness-ready', 'true');

  if (!items.length) {
    const p = document.createElement('p'); p.className = 'empty';
    p.textContent = 'No saved searches yet. Run a search and click “Save search”.';
    container.appendChild(p);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'bookmark-list';
  for (const s of items) {
    const li = document.createElement('li');
    li.className = 'bookmark';
    const body = document.createElement('div');
    body.className = 'body';
    const parts = [];
    if (s.queryText) parts.push(`query: “${s.queryText}”`);
    if (s.includeTags.length) parts.push(`include ${s.includeTags.map((t) => '#' + t).join(', ')}`);
    if (s.excludeTags.length) parts.push(`exclude ${s.excludeTags.map((t) => '#' + t).join(', ')}`);
    body.innerHTML = `<span class="title">${escapeText(s.name)}</span><p class="desc">${escapeText(parts.join(' · ') || 'all bookmarks')}</p>`;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const open = btn('Open', () => {
      state.q = s.queryText || '';
      state.includeTags = [...s.includeTags];
      state.excludeTags = [...s.excludeTags];
      state.page = 1; state.selection.clear(); state.selectAllMatching = false;
      navigate('#/all');
    });
    const del = btn('Delete', async () => { if (confirm('Delete this saved search?')) { await api.deleteSavedSearch(s.id); renderSavedSearches(container, state, navigate); } }, 'danger');
    actions.append(open, del);
    li.append(body, actions);
    list.appendChild(li);
  }
  container.appendChild(list);
}

function btn(label, onClick, cls = '') { const b = document.createElement('button'); b.type = 'button'; if (cls) b.className = cls; b.textContent = label; b.onclick = onClick; return b; }
function escapeText(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
