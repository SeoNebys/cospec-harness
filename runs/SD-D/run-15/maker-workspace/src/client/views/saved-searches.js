// Saved searches (US9): create (text + included/excluded tags), list, run, delete.
import { api } from '../lib/api.js';
import { escapeHtml, truncate } from '../lib/dom.js';

export async function renderSavedSearches(appEl) {
  appEl.innerHTML = `
    <section class="view">
      <h1 class="view-title">Saved searches</h1>
      <form id="ss-form" class="form">
        <label>Name <input name="name" type="text" placeholder="e.g. Unread reading" required /></label>
        <label>Search text <span class="hint">(optional)</span>
          <input name="query_text" type="text" placeholder="keywords, &quot;phrases&quot;, AND/OR/NOT" />
        </label>
        <label>Include tags <span class="hint">(comma-separated)</span>
          <input name="included" type="text" placeholder="work, reading" />
        </label>
        <label>Exclude tags <span class="hint">(comma-separated)</span>
          <input name="excluded" type="text" placeholder="archived-notes" />
        </label>
        <div class="form-actions"><button type="submit" class="btn btn-primary">Save search</button></div>
      </form>

      <h2 style="margin-top:1.2rem;">Your saved searches</h2>
      <ul id="ss-list" class="saved-search-list"><li class="loading">Loading…</li></ul>
      <div id="ss-results"></div>
    </section>`;

  const listEl = appEl.querySelector('#ss-list');
  const resultsEl = appEl.querySelector('#ss-results');

  async function loadList() {
    const { items } = await api.savedSearches();
    if (!items.length) {
      listEl.innerHTML = '<li class="muted">No saved searches yet.</li>';
      return;
    }
    listEl.innerHTML = items
      .map((s) => {
        const bits = [];
        if (s.query_text) bits.push(`text: “${escapeHtml(truncate(s.query_text, 40))}”`);
        if (s.included_tags.length) bits.push(`+${s.included_tags.map(escapeHtml).join(', +')}`);
        if (s.excluded_tags.length) bits.push(`−${s.excluded_tags.map(escapeHtml).join(', −')}`);
        return `<li data-id="${s.id}">
          <span class="ss-name">${escapeHtml(s.name)}</span>
          <span class="hint">${bits.join(' · ') || 'all bookmarks'}</span>
          <span class="ss-actions">
            <button class="btn btn-small" data-run>Run</button>
            <button class="btn btn-small btn-danger" data-del>Delete</button>
          </span>
        </li>`;
      })
      .join('');
  }

  const parseTags = (s) => s.split(',').map((t) => t.trim()).filter(Boolean);

  appEl.querySelector('#ss-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    await api.createSavedSearch({
      name: f.name.value,
      query_text: f.query_text.value,
      included_tags: parseTags(f.included.value),
      excluded_tags: parseTags(f.excluded.value),
    });
    f.reset();
    loadList();
  });

  listEl.addEventListener('click', async (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const id = Number(li.dataset.id);
    if (e.target.closest('[data-del]')) {
      await api.deleteSavedSearch(id);
      resultsEl.innerHTML = '';
      loadList();
    } else if (e.target.closest('[data-run]')) {
      const { items, saved_search } = await api.runSavedSearch(id);
      resultsEl.innerHTML = `
        <h2>Results for “${escapeHtml(saved_search.name)}” <span class="count">${items.length}</span></h2>
        ${items.length ? `<ul class="bookmark-list">${items.map(mini).join('')}</ul>` : '<div class="empty-state" data-empty="no-results"><h2>No results</h2><p>Nothing matched this saved search.</p></div>'}`;
    }
  });

  await loadList();
}

function mini(b) {
  const tags = (b.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  return `<li class="bookmark"><div class="bm-main">
      <a class="bm-title" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(truncate(b.title, 100))}</a>
      <div class="bm-tags">${tags}</div>
    </div></li>`;
}
