// T023 [US3]: tag input with chips + existing-tag suggestions (FR-011, FR-012).
import { escapeHtml } from './dom.js';

export function createTagInput(container, initialTags = []) {
  let tags = [...initialTags];
  container.classList.add('tag-input');
  container.innerHTML = `
    <div class="tag-chips"></div>
    <div class="tag-entry">
      <input type="text" class="tag-field" placeholder="Add a tag…" aria-label="Add a tag" />
      <ul class="tag-suggestions" hidden></ul>
    </div>`;
  const chipsEl = container.querySelector('.tag-chips');
  const field = container.querySelector('.tag-field');
  const suggEl = container.querySelector('.tag-suggestions');

  function renderChips() {
    chipsEl.innerHTML = tags
      .map(
        (t, i) =>
          `<span class="tag chip">${escapeHtml(t)}<button type="button" class="chip-x" data-i="${i}" aria-label="Remove ${escapeHtml(t)}">×</button></span>`
      )
      .join('');
  }
  function addTag(name) {
    const n = String(name || '').trim();
    if (n && !tags.some((t) => t.toLowerCase() === n.toLowerCase())) {
      tags.push(n);
      renderChips();
    }
    field.value = '';
    hideSuggestions();
  }
  function hideSuggestions() {
    suggEl.hidden = true;
    suggEl.innerHTML = '';
  }
  async function showSuggestions() {
    const prefix = field.value.trim();
    if (!prefix) return hideSuggestions();
    try {
      const res = await fetch(`/api/tags?prefix=${encodeURIComponent(prefix)}`);
      const { tags: names } = await res.json();
      const filtered = names.filter((n) => !tags.some((t) => t.toLowerCase() === n.toLowerCase()));
      if (!filtered.length) return hideSuggestions();
      suggEl.innerHTML = filtered
        .map((n) => `<li><button type="button" class="tag-suggestion" data-name="${escapeHtml(n)}">${escapeHtml(n)}</button></li>`)
        .join('');
      suggEl.hidden = false;
    } catch {
      hideSuggestions();
    }
  }

  chipsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-x');
    if (btn) {
      tags.splice(Number(btn.dataset.i), 1);
      renderChips();
    }
  });
  field.addEventListener('input', showSuggestions);
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(field.value);
    } else if (e.key === 'Backspace' && !field.value && tags.length) {
      tags.pop();
      renderChips();
    }
  });
  suggEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.tag-suggestion');
    if (btn) addTag(btn.dataset.name);
  });
  field.addEventListener('blur', () => setTimeout(hideSuggestions, 150));

  renderChips();
  return {
    getTags: () => [...tags],
    // commit any half-typed tag before save
    flush: () => {
      if (field.value.trim()) addTag(field.value);
    },
  };
}
