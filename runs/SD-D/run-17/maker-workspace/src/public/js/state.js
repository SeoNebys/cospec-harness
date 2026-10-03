// Shared app state + list loading. Components import this and call reload().
import { api } from './api.js';

export const state = {
  view: 'normal',
  q: '',
  sort: '',            // '' => use preference default (server decides)
  includeTags: [],
  excludeTags: [],
  page: 1,
  items: [],
  total: 0,
  selection: new Set(),
  prefs: { default_sort: 'newest', page_size: 25, text_size: 'medium' },
};

const listeners = [];
export function onChange(fn) { listeners.push(fn); }
function emit() { listeners.forEach((fn) => fn()); }

export function currentQueryParams() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  p.set('view', state.view);
  if (state.sort) p.set('sort', state.sort);
  state.includeTags.forEach((t) => p.append('include_tags', t));
  state.excludeTags.forEach((t) => p.append('exclude_tags', t));
  p.set('page', String(state.page));
  return p;
}

// selectAll payload mirrors the current filter so bulk affects the same set.
export function selectAllPayload() {
  return {
    q: state.q,
    view: state.view,
    include_tags: state.includeTags,
    exclude_tags: state.excludeTags,
  };
}

let lastError = '';
export function getError() { return lastError; }

export async function reload() {
  try {
    const data = await api.get('/api/bookmarks?' + currentQueryParams().toString());
    state.items = data.items;
    state.total = data.total;
    // Drop selections no longer visible.
    const visible = new Set(data.items.map((b) => b.id));
    state.selection = new Set([...state.selection].filter((id) => visible.has(id)));
    lastError = '';
  } catch (e) {
    state.items = [];
    state.total = 0;
    lastError = e.message;
  }
  emit();
}
