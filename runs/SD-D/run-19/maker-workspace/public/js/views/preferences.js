import { api } from '../api.js';

export async function renderPreferences(container, state, applyPrefs) {
  container.innerHTML = '<h2>Preferences</h2><p class="loading">Loading…</p>';
  const prefs = await api.preferences();
  container.innerHTML = `
    <h2>Preferences</h2>
    <form id="prefs-form" class="modal" style="max-width:520px;margin:0">
      <div class="field"><label>Default sort</label>
        <select name="defaultSort">
          <option value="date_added_desc">Newest first</option>
          <option value="date_added_asc">Oldest first</option>
          <option value="title_asc">Title A–Z</option>
          <option value="title_desc">Title Z–A</option>
        </select></div>
      <div class="field"><label>Items shown per page</label>
        <input name="itemsPerPage" type="number" min="1" max="500" value="${prefs.itemsPerPage}" /></div>
      <div class="field"><label>Text size</label>
        <select name="textSize"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></div>
      <hr />
      <h3>Import / export</h3>
      <div class="field"><label>Import browser bookmarks (HTML)</label>
        <input type="file" id="import-file" accept=".html,text/html" />
        <button type="button" id="import-btn">Import</button>
        <span class="hint" id="import-status"></span></div>
      <div class="field"><label>Export</label>
        <a href="/api/export" download="bookmarks.html"><button type="button">Download bookmarks.html</button></a></div>
      <p class="form-error" id="prefs-error" hidden></p>
      <div class="form-actions"><button type="submit" class="primary">Save preferences</button></div>
    </form>`;
  document.querySelector('#app')?.setAttribute('data-harness-ready', 'true');

  const form = container.querySelector('#prefs-form');
  form.defaultSort.value = prefs.defaultSort;
  form.textSize.value = prefs.textSize;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = container.querySelector('#prefs-error'); err.hidden = true;
    try {
      const updated = await api.updatePreferences({
        defaultSort: form.defaultSort.value,
        itemsPerPage: Number(form.itemsPerPage.value),
        textSize: form.textSize.value,
      });
      applyPrefs(updated);
      err.hidden = false; err.style.color = 'green'; err.textContent = 'Preferences saved.';
    } catch (e2) { err.hidden = false; err.style.color = ''; err.textContent = e2.message; }
  });

  container.querySelector('#import-btn').onclick = async () => {
    const fileInput = container.querySelector('#import-file');
    const status = container.querySelector('#import-status');
    if (!fileInput.files[0]) { status.textContent = 'Choose a file first.'; return; }
    status.textContent = 'Importing…';
    const fd = new FormData(); fd.append('file', fileInput.files[0]);
    const res = await fetch('/api/import', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) { status.textContent = data?.error?.message || 'Import failed.'; return; }
    status.textContent = `Imported ${data.imported}, skipped ${data.skippedDuplicates} duplicate(s)` +
      (data.failed.length ? `, ${data.failed.length} could not be read.` : '.');
  };
}
