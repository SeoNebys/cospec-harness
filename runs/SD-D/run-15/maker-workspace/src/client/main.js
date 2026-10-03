// SPA bootstrap + hash router. Marks data-harness-ready after first render.
import { renderList } from './views/list.js';
import { renderEditor } from './views/editor.js';
import { renderSettings } from './views/settings.js';
import { renderSavedSearches } from './views/saved-searches.js';
import { api } from './lib/api.js';
import { applyTextSize } from './lib/prefs.js';
import { escapeHtml } from './lib/dom.js';

const appEl = document.getElementById('app');
let firstRenderDone = false;
let prefsApplied = false;

function markReadyOnce() {
  if (firstRenderDone) return;
  firstRenderDone = true;
  appEl.setAttribute('data-harness-ready', 'true');
}

async function applyPrefsOnce() {
  if (prefsApplied) return;
  prefsApplied = true;
  try {
    const prefs = await api.getPreferences();
    applyTextSize(prefs.text_size);
  } catch {
    /* non-fatal */
  }
}

function parseHash() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  return hash.split('/').filter(Boolean);
}

function setActiveNav(view) {
  document.querySelectorAll('.main-nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === view);
  });
}

async function route() {
  const parts = parseHash();
  try {
    if (parts[0] === 'new') {
      setActiveNav(null);
      await renderEditor(appEl, { mode: 'create' });
    } else if (parts[0] === 'edit' && parts[1]) {
      setActiveNav(null);
      await renderEditor(appEl, { mode: 'edit', id: Number(parts[1]) });
    } else if (parts[0] === 'settings') {
      setActiveNav('settings');
      await renderSettings(appEl);
    } else if (parts[0] === 'saved') {
      setActiveNav('saved');
      await renderSavedSearches(appEl);
    } else if (parts[0] === 'unread') {
      setActiveNav('unread');
      await renderList(appEl, { view: 'unread' });
    } else if (parts[0] === 'archive') {
      setActiveNav('archive');
      await renderList(appEl, { view: 'archive' });
    } else {
      setActiveNav('all');
      await renderList(appEl, { view: 'all' });
    }
  } catch (err) {
    appEl.innerHTML = `<div class="error-box">Something went wrong: ${escapeHtml(err.message)}</div>`;
  } finally {
    markReadyOnce();
  }
}

window.addEventListener('hashchange', route);

async function boot() {
  await applyPrefsOnce();
  await route();
}

if (document.readyState !== 'loading') boot();
else window.addEventListener('DOMContentLoaded', boot);
