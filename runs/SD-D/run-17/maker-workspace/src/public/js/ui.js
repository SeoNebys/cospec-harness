// Small modal + message helpers.
const backdrop = () => document.getElementById('modal-backdrop');
const modalEl = () => document.getElementById('modal');

export function openModal(node) {
  const m = modalEl();
  m.innerHTML = '';
  m.append(node);
  backdrop().hidden = false;
}
export function closeModal() {
  backdrop().hidden = true;
  modalEl().innerHTML = '';
}
document.addEventListener('click', (e) => {
  if (e.target === backdrop()) closeModal();
});

export function showMessage(text, isError = false) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.className = 'message' + (isError ? ' error' : '');
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 5000);
}

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}
