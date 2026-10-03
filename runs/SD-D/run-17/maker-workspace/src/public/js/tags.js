// Tag input widget with type-ahead suggestions (FR-014/FR-014a).
import { api } from './api.js';

// Creates a tag input bound to an array of tag names. Returns { element, getTags }.
export function createTagInput(initial = []) {
  const tags = [...initial];
  const wrap = document.createElement('div');
  wrap.className = 'tag-input-wrap';

  const chips = document.createElement('div');
  chips.className = 'tags';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Add tag…';
  input.autocomplete = 'off';
  const sugg = document.createElement('div');
  sugg.className = 'suggestions';
  sugg.hidden = true;

  wrap.append(chips, input, sugg);

  function renderChips() {
    chips.innerHTML = '';
    tags.forEach((t, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = t;
      const x = document.createElement('button');
      x.type = 'button';
      x.textContent = '×';
      x.onclick = () => { tags.splice(i, 1); renderChips(); };
      chip.append(x);
      chips.append(chip);
    });
  }

  function addTag(name) {
    const clean = name.trim();
    if (!clean) return;
    // Reuse existing (case-insensitive) name; never duplicate (FR-014a).
    if (!tags.some((t) => t.toLowerCase() === clean.toLowerCase())) tags.push(clean);
    input.value = '';
    sugg.hidden = true;
    renderChips();
  }

  let activeIdx = -1;
  async function showSuggestions() {
    const q = input.value.trim();
    if (!q) { sugg.hidden = true; return; }
    const { tags: matches } = await api.get('/api/tags?q=' + encodeURIComponent(q));
    const filtered = matches.filter((m) => !tags.some((t) => t.toLowerCase() === m.toLowerCase()));
    if (filtered.length === 0) { sugg.hidden = true; return; }
    sugg.innerHTML = '';
    activeIdx = -1;
    filtered.slice(0, 8).forEach((m) => {
      const d = document.createElement('div');
      d.textContent = m;
      d.onmousedown = (e) => { e.preventDefault(); addTag(m); };
      sugg.append(d);
    });
    sugg.hidden = false;
  }

  input.addEventListener('input', showSuggestions);
  input.addEventListener('keydown', (e) => {
    const opts = [...sugg.querySelectorAll('div')];
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && opts[activeIdx]) addTag(opts[activeIdx].textContent);
      else addTag(input.value);
    } else if (e.key === 'ArrowDown' && opts.length) {
      e.preventDefault(); activeIdx = (activeIdx + 1) % opts.length;
      opts.forEach((o, i) => o.classList.toggle('active', i === activeIdx));
    } else if (e.key === 'ArrowUp' && opts.length) {
      e.preventDefault(); activeIdx = (activeIdx - 1 + opts.length) % opts.length;
      opts.forEach((o, i) => o.classList.toggle('active', i === activeIdx));
    } else if (e.key === 'Escape') {
      sugg.hidden = true;
    } else if ((e.key === ',' )) {
      e.preventDefault(); addTag(input.value);
    }
  });
  input.addEventListener('blur', () => { setTimeout(() => (sugg.hidden = true), 150); });

  renderChips();
  return { element: wrap, getTags: () => [...tags] };
}
