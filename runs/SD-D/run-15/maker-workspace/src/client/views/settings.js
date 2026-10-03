// Settings (US10 preferences + US12 import/export).
import { api } from '../lib/api.js';
import { escapeHtml } from '../lib/dom.js';
import { applyTextSize } from '../lib/prefs.js';

const SORTS = [
  ['date_added_desc', 'Newest first'],
  ['date_added_asc', 'Oldest first'],
  ['title_asc', 'Title A–Z'],
  ['title_desc', 'Title Z–A'],
];
const SIZES = [
  ['small', 'Small'],
  ['medium', 'Medium'],
  ['large', 'Large'],
];

export async function renderSettings(appEl) {
  const prefs = await api.getPreferences();
  appEl.innerHTML = `
    <section class="view">
      <h1 class="view-title">Settings</h1>

      <form id="prefs-form" class="form">
        <h2>Display</h2>
        <label>Default sort
          <select name="default_sort">
            ${SORTS.map(([v, l]) => `<option value="${v}"${v === prefs.default_sort ? ' selected' : ''}>${l}</option>`).join('')}
          </select>
        </label>
        <label>Items shown per page
          <input name="page_size" type="number" min="1" max="500" value="${prefs.page_size}" />
        </label>
        <label>Text size
          <select name="text_size">
            ${SIZES.map(([v, l]) => `<option value="${v}"${v === prefs.text_size ? ' selected' : ''}>${l}</option>`).join('')}
          </select>
        </label>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save preferences</button>
          <span class="saved-note" role="status" hidden>Saved.</span>
        </div>
      </form>

      <div class="form" style="margin-top:1.2rem;">
        <h2>Import &amp; export</h2>
        <p class="hint">Uses the standard browser-bookmark HTML format (preserves titles, tags, and original dates).</p>
        <div class="form-actions">
          <a class="btn" href="/api/export" download="bookmarks.html">Export bookmarks</a>
        </div>
        <label>Import a bookmarks HTML file
          <input id="import-file" type="file" accept=".html,text/html" />
        </label>
        <div class="form-actions">
          <button id="import-btn" type="button" class="btn btn-primary">Import</button>
          <span class="import-status" role="status" hidden></span>
        </div>
      </div>
    </section>`;

  const form = appEl.querySelector('#prefs-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      default_sort: form.default_sort.value,
      page_size: Number(form.page_size.value),
      text_size: form.text_size.value,
    };
    const saved = await api.updatePreferences(payload);
    applyTextSize(saved.text_size);
    const note = form.querySelector('.saved-note');
    note.hidden = false;
    setTimeout(() => (note.hidden = true), 1500);
  });

  const importBtn = appEl.querySelector('#import-btn');
  const importStatus = appEl.querySelector('.import-status');
  importBtn.addEventListener('click', async () => {
    const fileInput = appEl.querySelector('#import-file');
    if (!fileInput.files.length) {
      importStatus.hidden = false;
      importStatus.textContent = 'Choose a file first.';
      return;
    }
    importStatus.hidden = false;
    importStatus.textContent = 'Importing…';
    try {
      const fd = new FormData();
      fd.append('file', fileInput.files[0]);
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      importStatus.textContent = `Imported ${data.added} bookmark(s); skipped ${data.skipped} duplicate(s).`;
    } catch (err) {
      importStatus.textContent = escapeHtml(err.message);
    }
  });
}
