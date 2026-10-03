import { api } from '../api.js';

/**
 * A tag input with existing-tag suggestions. Renders into `container`.
 * Returns an object with getTags() and setTags().
 */
export function createTagInput(container, initial = []) {
  let tags = [...initial];
  container.classList.add('tag-input');
  container.innerHTML = `
    <div class="tag-chips"></div>
    <input type="text" placeholder="Add a tag and press Enter" autocomplete="off" />
    <ul class="suggestions" hidden></ul>`;
  const chips = container.querySelector('.tag-chips');
  const input = container.querySelector('input');
  const suggestions = container.querySelector('.suggestions');
  let activeIndex = -1;

  function renderChips() {
    chips.innerHTML = '';
    tags.forEach((t) => {
      const chip = document.createElement('span');
      chip.className = 'tag';
      chip.textContent = t;
      const rm = document.createElement('button');
      rm.type = 'button'; rm.textContent = '×'; rm.setAttribute('aria-label', `Remove ${t}`);
      rm.onclick = () => { tags = tags.filter((x) => x !== t); renderChips(); };
      chip.appendChild(rm);
      chips.appendChild(chip);
    });
  }

  function addTag(name) {
    const clean = name.trim();
    if (clean && !tags.some((t) => t.toLowerCase() === clean.toLowerCase())) tags.push(clean);
    input.value = ''; hideSuggestions(); renderChips();
  }

  function hideSuggestions() { suggestions.hidden = true; suggestions.innerHTML = ''; activeIndex = -1; }

  async function showSuggestions() {
    const prefix = input.value.trim();
    if (!prefix) return hideSuggestions();
    const { tags: found } = await api.tags(prefix);
    const list = found.filter((t) => !tags.some((x) => x.toLowerCase() === t.name.toLowerCase()));
    if (!list.length) return hideSuggestions();
    suggestions.innerHTML = '';
    list.slice(0, 8).forEach((t, i) => {
      const li = document.createElement('li');
      li.textContent = `${t.name} (${t.count})`;
      li.dataset.name = t.name;
      li.onmousedown = (e) => { e.preventDefault(); addTag(t.name); };
      suggestions.appendChild(li);
    });
    suggestions.hidden = false;
  }

  input.addEventListener('input', showSuggestions);
  input.addEventListener('keydown', (e) => {
    const items = [...suggestions.querySelectorAll('li')];
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) addTag(items[activeIndex].dataset.name);
      else addTag(input.value);
    } else if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault(); activeIndex = (activeIndex + 1) % items.length; highlight(items);
    } else if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault(); activeIndex = (activeIndex - 1 + items.length) % items.length; highlight(items);
    } else if (e.key === 'Escape') { hideSuggestions(); }
  });
  input.addEventListener('blur', () => setTimeout(hideSuggestions, 150));

  function highlight(items) { items.forEach((el, i) => el.classList.toggle('active', i === activeIndex)); }

  renderChips();
  return {
    getTags: () => [...tags],
    setTags: (next) => { tags = [...next]; renderChips(); },
  };
}
