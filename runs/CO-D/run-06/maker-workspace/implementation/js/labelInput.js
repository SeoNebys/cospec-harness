// labelInput.js — reusable label editor: chips + type-ahead + no near-duplicates.
// Implements SCN-002 (case-insensitive, first-spelling-wins, suggest existing).

import { canonicalLabel } from './store.js';

export function createLabelInput(mount, { initial = [], getExisting, onChange = () => {} } = {}) {
  let labels = [...initial];
  const wrap = document.createElement('div');
  wrap.className = 'label-input';
  const chips = document.createElement('div'); chips.className = 'chips';
  const menu = document.createElement('div'); menu.className = 'label-menu';
  wrap.appendChild(chips); wrap.appendChild(menu);
  mount.appendChild(wrap);

  let input;
  function has(text) { const n = text.toLowerCase(); return labels.some(l => l.toLowerCase() === n); }

  function add(text) {
    const r = canonicalLabel(text, getExisting());
    if (!r) return;
    if (!has(r.canonical)) { labels.push(r.canonical); onChange(getValue()); }
    input.value = ''; hideMenu(); render();
    input.focus();
  }
  function remove(l) { labels = labels.filter(x => x !== l); onChange(getValue()); render(); }

  function render() {
    chips.innerHTML = '';
    labels.forEach(l => {
      const c = document.createElement('span'); c.className = 'chip';
      const t = document.createElement('span'); t.textContent = l;
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '×';
      x.setAttribute('aria-label', 'remove ' + l);
      x.addEventListener('click', () => remove(l));
      c.appendChild(t); c.appendChild(x); chips.appendChild(c);
    });
    input = document.createElement('input');
    input.type = 'text'; input.placeholder = labels.length ? 'add another…' : 'type a label…';
    input.addEventListener('input', onType);
    input.addEventListener('keydown', onKey);
    input.addEventListener('blur', () => setTimeout(hideMenu, 120));
    chips.appendChild(input);
  }

  function onType() {
    const q = input.value.trim().toLowerCase();
    if (!q) return hideMenu();
    const existing = getExisting();
    const matches = existing.filter(l => l.toLowerCase().includes(q) && !has(l)).slice(0, 6);
    const exact = existing.some(l => l.toLowerCase() === q);
    menu.innerHTML = '';
    matches.forEach(l => menu.appendChild(opt(l, 'use', l)));
    if (!exact) menu.appendChild(opt('+ create “' + input.value.trim() + '”', 'create', input.value.trim(), true));
    menu.classList.add('show');
  }
  function opt(label, kind, value, isCreate) {
    const d = document.createElement('div');
    d.className = 'label-opt' + (isCreate ? ' create' : '');
    d.textContent = label;
    d.addEventListener('mousedown', e => { e.preventDefault(); add(value); });
    return d;
  }
  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); const v = input.value.trim(); if (v) add(v); }
    else if (e.key === 'Backspace' && !input.value && labels.length) { remove(labels[labels.length - 1]); }
  }
  function hideMenu() { menu.classList.remove('show'); menu.innerHTML = ''; }
  function getValue() { return [...labels]; }

  render();
  return { getValue, focus: () => input && input.focus() };
}
