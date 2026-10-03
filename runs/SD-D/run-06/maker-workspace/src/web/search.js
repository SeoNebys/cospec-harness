// Search + tag-autocomplete helpers used by app.js.

export async function fetchSuggestions(q) {
  if (!q) return [];
  const res = await fetch(`/api/tags/suggest?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.suggestions || [];
}

// Attach type-ahead tag suggestions (FR-009) to a text input whose value is a
// comma-separated tag list. Calls nothing else; edits the input in place.
export function attachTagAutocomplete(input, container) {
  let items = [];
  let active = -1;

  const currentToken = () => {
    const parts = input.value.split(',');
    return parts[parts.length - 1].trim();
  };
  const applyToken = (name) => {
    const parts = input.value.split(',');
    parts[parts.length - 1] = ' ' + name;
    input.value = parts.join(',').replace(/^\s+/, '') + ', ';
    hide();
    input.focus();
  };
  const hide = () => { container.innerHTML = ''; container.hidden = true; items = []; active = -1; };
  const render = () => {
    container.innerHTML = '';
    if (!items.length) { container.hidden = true; return; }
    container.hidden = false;
    items.forEach((name, i) => {
      const div = document.createElement('div');
      div.textContent = name;
      if (i === active) div.style.background = '#eef2ff';
      div.addEventListener('mousedown', (e) => { e.preventDefault(); applyToken(name); });
      container.appendChild(div);
    });
  };

  input.addEventListener('input', async () => {
    const token = currentToken();
    if (!token) return hide();
    items = await fetchSuggestions(token);
    active = -1;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (container.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); applyToken(items[active]); }
    else if (e.key === 'Escape') hide();
  });
  input.addEventListener('blur', () => setTimeout(hide, 150));
}
