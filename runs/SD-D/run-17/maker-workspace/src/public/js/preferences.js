// Display preferences (FR-024).
import { api } from './api.js';
import { state, reload } from './state.js';
import { openModal, closeModal, showMessage, el } from './ui.js';

export function applyTextSize() {
  document.body.dataset.textSize = state.prefs.text_size || 'medium';
}

export async function loadPreferences() {
  const { preferences } = await api.get('/api/preferences');
  state.prefs = preferences;
  applyTextSize();
  // Reflect default sort in the sort selector when no explicit override.
  if (!state.sort) document.getElementById('sort').value = preferences.default_sort;
}

export function openPreferences() {
  const sortSel = el('select', {}, [
    opt('newest', 'Newest'), opt('oldest', 'Oldest'), opt('title', 'Title'), opt('updated', 'Last updated'),
  ]);
  sortSel.value = state.prefs.default_sort;
  const pageSize = el('input', { type: 'number', min: '1', max: '500', value: String(state.prefs.page_size) });
  const textSize = el('select', {}, [opt('small', 'Small'), opt('medium', 'Medium'), opt('large', 'Large')]);
  textSize.value = state.prefs.text_size;

  const form = el('div', {}, [
    el('h2', {}, 'Preferences'),
    el('div', { className: 'field' }, [el('label', {}, 'Default sort'), sortSel]),
    el('div', { className: 'field' }, [el('label', {}, 'Items per page'), pageSize]),
    el('div', { className: 'field' }, [el('label', {}, 'Text size'), textSize]),
    el('div', { className: 'modal-actions' }, [
      el('button', { className: 'ghost', onclick: closeModal }, 'Cancel'),
      el('button', { onclick: save }, 'Save'),
    ]),
  ]);
  openModal(form);

  async function save() {
    try {
      const { preferences } = await api.patch('/api/preferences', {
        default_sort: sortSel.value,
        page_size: parseInt(pageSize.value, 10),
        text_size: textSize.value,
      });
      state.prefs = preferences;
      applyTextSize();
      if (!state.sort) document.getElementById('sort').value = preferences.default_sort;
      closeModal();
      showMessage('Preferences saved.');
      reload();
    } catch (e) { showMessage(e.message, true); }
  }
}

function opt(value, label) { return el('option', { value }, label); }
