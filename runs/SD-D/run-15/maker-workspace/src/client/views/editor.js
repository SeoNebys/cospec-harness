// Editor (US1 create/edit + US3 tags + US4 note/delete + US11 saved copies).
import { api } from '../lib/api.js';
import { escapeHtml } from '../lib/dom.js';
import { createTagInput } from '../lib/tag-suggest.js';

export async function renderEditor(appEl, { mode, id } = {}) {
  if (mode === 'create') {
    appEl.innerHTML = createForm();
    wireCreate(appEl);
    return;
  }
  const b = await api.getBookmark(id);
  appEl.innerHTML = editForm(b);
  wireEdit(appEl, b);
}

function createForm() {
  return `
    <section class="view editor">
      <h1 class="view-title">Add a bookmark</h1>
      <form id="create-form" class="form">
        <label>Web address
          <input name="url" type="text" placeholder="example.com or https://…" autofocus required />
        </label>
        <label>Title <span class="hint">(optional — captured automatically)</span>
          <input name="title" type="text" placeholder="Leave blank to auto-fill" />
        </label>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save bookmark</button>
          <a class="btn" href="#/">Cancel</a>
        </div>
      </form>
    </section>`;
}

function editForm(b) {
  return `
    <section class="view editor">
      <h1 class="view-title">Edit bookmark</h1>
      <form id="edit-form" class="form" data-id="${b.id}">
        ${b.preview_image ? `<img class="preview-img" src="${escapeHtml(b.preview_image)}" alt="" />` : ''}
        <label>Title <input name="title" type="text" value="${escapeHtml(b.title)}" /></label>
        <label>Description <textarea name="description" rows="2">${escapeHtml(b.description)}</textarea></label>
        <label>Web address <input name="url" type="text" value="${escapeHtml(b.url)}" /></label>
        <label>Tags</label>
        <div class="tag-input-host"></div>
        <label>Note <span class="hint">(Markdown: **bold**, *italics*, lists, [links](url))</span>
          <textarea name="note" rows="4" class="note-field">${escapeHtml(b.note)}</textarea>
        </label>
        <div class="note-preview-wrap">
          <span class="hint">Preview</span>
          <div class="note-preview">${b.note_html || '<em class="muted">Nothing yet.</em>'}</div>
        </div>
        <p class="form-error" role="alert" hidden></p>
        <p class="saved-note" role="status" hidden>Saved.</p>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save changes</button>
          <a class="btn" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">Open ↗</a>
          <a class="btn" href="#/">Back</a>
          <button type="button" class="btn btn-danger" data-delete>Delete…</button>
        </div>
      </form>

      <div class="copies-panel">
        <h2>Saved copies</h2>
        <p class="hint">Preserve this page against link rot.</p>
        <div class="copies-actions">
          <button type="button" class="btn btn-small" data-copy="snapshot">Save a local copy</button>
          <button type="button" class="btn btn-small" data-copy="archive">Preserve via Internet Archive</button>
        </div>
        <p class="copies-status" role="status" hidden></p>
        <ul class="copies-list">${copiesHtml(b.saved_copies || [])}</ul>
      </div>
    </section>`;
}

function copiesHtml(copies) {
  const label = { html_snapshot: 'Local HTML copy', pdf: 'Stored PDF', internet_archive: 'Internet Archive' };
  return copies
    .map(
      (c) =>
        `<li>${escapeHtml(label[c.kind] || c.kind)} — <a href="/api/saved-copies/${c.id}/content" target="_blank" rel="noopener">open</a> <span class="hint">${escapeHtml(c.created_at.slice(0, 10))}</span></li>`
    )
    .join('') || '<li class="muted">No saved copies yet.</li>';
}

function showError(form, message) {
  const el = form.querySelector('.form-error');
  el.textContent = message;
  el.hidden = false;
}

function wireCreate(appEl) {
  const form = appEl.querySelector('#create-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.querySelector('.form-error').hidden = true;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const created = await api.createBookmark({ url: form.url.value, title: form.title.value });
      window.location.hash = `#/edit/${created.id}`;
    } catch (err) {
      if (err.status === 409 && err.data?.existingId) {
        window.location.hash = `#/edit/${err.data.existingId}`;
        return;
      }
      showError(form, err.message);
      submitBtn.disabled = false;
    }
  });
}

function wireEdit(appEl, bookmark) {
  const form = appEl.querySelector('#edit-form');
  const tagInput = createTagInput(form.querySelector('.tag-input-host'), bookmark.tags || []);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.querySelector('.form-error').hidden = true;
    form.querySelector('.saved-note').hidden = true;
    tagInput.flush();
    try {
      const updated = await api.updateBookmark(bookmark.id, {
        title: form.title.value,
        description: form.description.value,
        url: form.url.value,
        note: form.note.value,
        tags: tagInput.getTags(),
      });
      appEl.querySelector('.note-preview').innerHTML = updated.note_html || '<em class="muted">Nothing yet.</em>';
      form.querySelector('.saved-note').hidden = false;
    } catch (err) {
      showError(form, err.message);
    }
  });

  form.querySelector('[data-delete]').addEventListener('click', async () => {
    if (!confirm('Permanently delete this bookmark? This cannot be undone.')) return;
    try {
      await api.deleteBookmark(bookmark.id);
      window.location.hash = '#/';
    } catch (err) {
      showError(form, err.message);
    }
  });

  const copiesPanel = appEl.querySelector('.copies-panel');
  const status = copiesPanel.querySelector('.copies-status');
  copiesPanel.querySelector('.copies-actions').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    status.hidden = false;
    status.className = 'copies-status';
    status.textContent = 'Working…';
    try {
      if (btn.dataset.copy === 'snapshot') await api.snapshot(bookmark.id);
      else await api.archiveCopy(bookmark.id);
      const fresh = await api.getBookmark(bookmark.id);
      copiesPanel.querySelector('.copies-list').innerHTML = copiesHtml(fresh.saved_copies || []);
      status.textContent = 'Saved copy created.';
    } catch (err) {
      status.className = 'copies-status error';
      status.textContent = err.message; // honest failure (FR-032)
    }
  });
}
