import { api } from '../api.js';
import { createTagInput } from '../components/tagInput.js';

const modalRoot = () => document.getElementById('modal-root');

function closeModal() { modalRoot().innerHTML = ''; }

/**
 * Open the add-bookmark flow: prompt for URL, fetch metadata (or route to an
 * existing bookmark on duplicate), then show the editable form before saving.
 */
export async function openAddBookmark(onSaved) {
  const url = window.prompt('Enter the web address to bookmark:');
  if (!url) return;
  let preview;
  try {
    preview = await api.previewBookmark(url);
  } catch (err) {
    window.alert(err.message);
    return;
  }
  if (preview.existing) {
    // Duplicate → open the existing bookmark for editing (FR-005).
    return openEditBookmark(preview.existing.id, onSaved);
  }
  showForm({
    mode: 'create',
    values: {
      url: preview.url,
      title: preview.title || '',
      description: preview.description || '',
      faviconUrl: preview.faviconUrl,
      previewImageUrl: preview.previewImageUrl,
      metadataUnavailable: preview.metadataUnavailable,
      noteMd: '', tags: [],
    },
    onSaved,
  });
}

export async function openEditBookmark(id, onSaved) {
  const bookmark = await api.getBookmark(id);
  showForm({ mode: 'edit', id, values: bookmark, onSaved });
}

function showForm({ mode, id, values, onSaved }) {
  const root = modalRoot();
  root.innerHTML = `
    <div class="modal-backdrop">
      <form class="modal" id="bookmark-form">
        <h2>${mode === 'create' ? 'Add bookmark' : 'Edit bookmark'}</h2>
        ${values.metadataUnavailable ? '<p class="hint">⚠️ Page metadata was unavailable; a title was derived from the address.</p>' : ''}
        <div class="field"><label>Address</label>
          <input name="url" type="url" required value="${escapeAttr(values.url)}" /></div>
        <div class="field"><label>Title</label>
          <input name="title" type="text" value="${escapeAttr(values.title)}" /></div>
        <div class="field"><label>Description</label>
          <textarea name="description" style="min-height:60px">${escapeText(values.description)}</textarea></div>
        <div class="field"><label>Tags</label><div id="tag-input"></div></div>
        <div class="field"><label>Note (Markdown)</label>
          <textarea name="noteMd" placeholder="Supports **Markdown**">${escapeText(values.noteMd)}</textarea>
          <span class="hint">Preview:</span>
          <div class="note-preview" id="note-preview">${values.noteHtml || ''}</div></div>
        ${mode === 'edit' ? preservationControls(values) : ''}
        <p class="form-error" id="form-error" hidden></p>
        <div class="form-actions">
          <button type="button" class="secondary" id="cancel">Cancel</button>
          <button type="submit" class="primary">${mode === 'create' ? 'Save bookmark' : 'Save changes'}</button>
        </div>
      </form>
    </div>`;

  const form = root.querySelector('#bookmark-form');
  const tagInput = createTagInput(root.querySelector('#tag-input'), values.tags || []);
  const noteField = form.noteMd;
  const preview = root.querySelector('#note-preview');
  let previewTimer;
  noteField.addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => { preview.innerHTML = renderMarkdownClient(noteField.value); }, 200);
  });

  root.querySelector('#cancel').onclick = closeModal;
  root.querySelector('.modal-backdrop').addEventListener('click', (e) => { if (e.target.classList.contains('modal-backdrop')) closeModal(); });

  if (mode === 'edit') wirePreservation(root, id, values);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = root.querySelector('#form-error');
    errorEl.hidden = true;
    const payload = {
      url: form.url.value.trim(),
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      noteMd: form.noteMd.value,
      tags: tagInput.getTags(),
    };
    try {
      if (mode === 'create') {
        const created = await api.createBookmark({ ...payload, faviconUrl: values.faviconUrl, previewImageUrl: values.previewImageUrl, metadataUnavailable: values.metadataUnavailable });
        if (created.existing) { closeModal(); return openEditBookmark(created.existing.id, onSaved); }
      } else {
        await api.updateBookmark(id, payload);
      }
      closeModal();
      onSaved && onSaved();
    } catch (err) {
      errorEl.hidden = false;
      errorEl.textContent = err.status === 409 ? 'Another bookmark already uses this address.' : err.message;
    }
  });
}

function preservationControls(values) {
  return `
    <fieldset style="border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.75rem">
      <legend>Preservation</legend>
      <div class="form-actions" style="justify-content:flex-start">
        <button type="button" id="preserve-btn">Preserve page copy</button>
        <button type="button" id="archive-org-btn">Save to Internet Archive</button>
      </div>
      <p class="hint" id="preserve-status">
        ${values.preservedHtmlPath || values.preservedPdfPath ? `<a href="/api/bookmarks/${values.id}/preserved" target="_blank">View preserved copy</a>` : 'No preserved copy yet.'}
        ${values.archiveOrgUrl ? ` · <a href="${escapeAttr(values.archiveOrgUrl)}" target="_blank">Internet Archive snapshot</a>` : ''}
      </p>
    </fieldset>`;
}

function wirePreservation(root, id, values) {
  const status = root.querySelector('#preserve-status');
  root.querySelector('#preserve-btn').onclick = async (e) => {
    e.target.disabled = true; status.textContent = 'Preserving…';
    try { await api.preserve(id); status.innerHTML = `<a href="/api/bookmarks/${id}/preserved" target="_blank">View preserved copy</a>`; }
    catch (err) { status.textContent = `Preservation did not complete: ${err.message}`; }
    finally { e.target.disabled = false; }
  };
  root.querySelector('#archive-org-btn').onclick = async (e) => {
    e.target.disabled = true; status.textContent = 'Submitting to Internet Archive…';
    try { const r = await api.archiveOrg(id); status.innerHTML = `<a href="${r.archiveOrgUrl}" target="_blank">Internet Archive snapshot</a>`; }
    catch (err) { status.textContent = `Internet Archive preservation did not complete: ${err.message}`; }
    finally { e.target.disabled = false; }
  };
}

// Minimal client-side Markdown preview (server renders the stored version).
function renderMarkdownClient(src) {
  let html = escapeText(src);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>').replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>').replace(/\n/g, '<br>');
  return html;
}

function escapeAttr(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function escapeText(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
