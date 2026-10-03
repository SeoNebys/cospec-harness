import { api } from './api.js';
import { renderListView } from './views/list.js';
import { renderSavedSearches } from './views/savedSearches.js';
import { renderPreferences } from './views/preferences.js';
import { openAddBookmark } from './views/edit.js';

const appEl = document.getElementById('app');

const state = {
  q: '', includeTags: [], excludeTags: [], sort: 'date_added_desc',
  page: 1, pageSize: 25, scope: 'all',
  selection: new Set(), selectAllMatching: false,
  _reload: null,
};

function applyPrefs(prefs) {
  state.sort = prefs.defaultSort;
  state.pageSize = prefs.itemsPerPage;
  document.body.dataset.textSize = prefs.textSize;
}

function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

async function route() {
  const hash = location.hash || '#/all';
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === hash));
  appEl.removeAttribute('data-harness-ready');
  appEl.innerHTML = '<p class="loading">Loading…</p>';

  if (hash === '#/all') return renderListView(appEl, 'all', state);
  if (hash === '#/unread') return renderListView(appEl, 'unread', state);
  if (hash === '#/archive') return renderListView(appEl, 'archive', state);
  if (hash === '#/saved') return renderSavedSearches(appEl, state, navigate);
  if (hash === '#/preferences') return renderPreferences(appEl, state, applyPrefs);
  return renderListView(appEl, 'all', state);
}

document.getElementById('add-button').addEventListener('click', () => {
  openAddBookmark(() => { if (state._reload) state._reload(); else route(); });
});

window.addEventListener('hashchange', route);

// Load preferences first so defaults apply, then render the initial view.
(async () => {
  try { applyPrefs(await api.preferences()); } catch { /* use defaults */ }
  route();
})();
