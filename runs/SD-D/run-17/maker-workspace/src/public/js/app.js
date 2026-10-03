// App bootstrap: wires events, loads data, sets data-harness-ready.
import { state, reload, onChange } from './state.js';
import { renderList, openSaveForm } from './bookmarks.js';
import { renderBulkBar } from './bulk.js';
import { renderFilterTagsBar, renderSavedFilters, openSaveFilterModal } from './filters.js';
import { loadPreferences, openPreferences } from './preferences.js';
import { initSearch } from './search.js';
import { api } from './api.js';
import { showMessage } from './ui.js';

function rerender() {
  renderList();
  renderBulkBar();
  renderFilterTagsBar();
}
onChange(rerender);

function wire() {
  // View tabs
  document.querySelectorAll('.view-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.view-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.view = tab.dataset.view;
      state.page = 1;
      state.selection.clear();
      reload();
    });
  });

  // Save flow
  const urlInput = document.getElementById('new-url');
  const preview = () => {
    const url = urlInput.value.trim();
    if (url) openSaveForm(url);
  };
  document.getElementById('preview-btn').addEventListener('click', preview);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') preview(); });

  // Sort
  const sortSel = document.getElementById('sort');
  sortSel.addEventListener('change', () => {
    state.sort = sortSel.value;
    reload();
  });

  // Save filter
  document.getElementById('save-filter-btn').addEventListener('click', openSaveFilterModal);

  // Preferences
  document.getElementById('prefs-btn').addEventListener('click', openPreferences);

  // Import / export
  const fileInput = document.getElementById('import-file');
  document.getElementById('import-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    if (!fileInput.files.length) return;
    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    try {
      const { imported, merged } = await api.upload('/api/import', fd);
      showMessage(`Imported ${imported}, merged ${merged}.`);
      reload();
      renderSavedFilters();
    } catch (e) { showMessage(e.message, true); }
    fileInput.value = '';
  });

  // Selection + tag-filter events
  document.addEventListener('selection-changed', () => renderBulkBar());
  document.addEventListener('add-include-tag', (e) => {
    if (!state.includeTags.includes(e.detail)) {
      state.includeTags.push(e.detail);
      state.page = 1;
      reload();
    }
  });
}

async function boot() {
  wire();
  initSearch();
  try {
    await loadPreferences();
  } catch { /* defaults are fine */ }
  await reload();
  await renderSavedFilters();
  // Signal presentation readiness after initial UI + data have loaded.
  document.getElementById('list').setAttribute('data-harness-ready', 'true');
}

boot();
