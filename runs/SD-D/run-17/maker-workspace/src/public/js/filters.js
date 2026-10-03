// Saved filters + active include/exclude tag bar (FR-019).
import { api } from './api.js';
import { state, reload } from './state.js';
import { openModal, closeModal, showMessage, el } from './ui.js';
import { createTagInput } from './tags.js';

export function renderFilterTagsBar() {
  const bar = document.getElementById('filter-tags-bar');
  bar.innerHTML = '';
  state.includeTags.forEach((t, i) => {
    bar.append(chip(t, 'chip', 'include: ', () => { state.includeTags.splice(i, 1); reload(); }));
  });
  state.excludeTags.forEach((t, i) => {
    bar.append(chip(t, 'chip exclude', 'exclude: ', () => { state.excludeTags.splice(i, 1); reload(); }));
  });
}

function chip(text, cls, prefix, onRemove) {
  const c = el('span', { className: cls }, prefix + text);
  const x = el('button', { onclick: onRemove }, '×');
  c.append(x);
  return c;
}

export async function renderSavedFilters() {
  const wrap = document.getElementById('saved-filters');
  wrap.innerHTML = '';
  let filters = [];
  try { ({ filters } = await api.get('/api/filters')); } catch { /* ignore */ }
  filters.forEach((f) => {
    const c = el('span', { className: 'chip saved-filter', title: 'Apply saved filter' }, '★ ' + f.name);
    c.onclick = () => applyFilter(f);
    const x = el('button', { title: 'Delete filter', onclick: async (e) => {
      e.stopPropagation();
      await api.del('/api/filters/' + f.id);
      renderSavedFilters();
    } }, '×');
    c.append(x);
    wrap.append(c);
  });
}

function applyFilter(f) {
  state.q = f.terms || '';
  state.includeTags = [...f.include_tags];
  state.excludeTags = [...f.exclude_tags];
  document.getElementById('search').value = state.q;
  state.page = 1;
  reload();
}

export function openSaveFilterModal() {
  const nameInput = el('input', { type: 'text', placeholder: 'Filter name' });
  const termsInput = el('input', { type: 'text', value: state.q });
  const includeInput = createTagInput(state.includeTags);
  const excludeInput = createTagInput(state.excludeTags);
  const form = el('div', {}, [
    el('h2', {}, 'Save filter'),
    el('div', { className: 'field' }, [el('label', {}, 'Name'), nameInput]),
    el('div', { className: 'field' }, [el('label', {}, 'Search terms'), termsInput]),
    el('div', { className: 'field' }, [el('label', {}, 'Include tags'), includeInput.element]),
    el('div', { className: 'field' }, [el('label', {}, 'Exclude tags'), excludeInput.element]),
    el('div', { className: 'modal-actions' }, [
      el('button', { className: 'ghost', onclick: closeModal }, 'Cancel'),
      el('button', { onclick: save }, 'Save'),
    ]),
  ]);
  openModal(form);

  async function save() {
    try {
      await api.post('/api/filters', {
        name: nameInput.value,
        terms: termsInput.value,
        include_tags: includeInput.getTags(),
        exclude_tags: excludeInput.getTags(),
      });
      closeModal();
      showMessage('Filter saved.');
      renderSavedFilters();
    } catch (e) { showMessage(e.message, true); }
  }
}
