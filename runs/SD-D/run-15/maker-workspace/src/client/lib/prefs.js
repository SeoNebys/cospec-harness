// Applies display preferences that affect the whole app (text size).
export function applyTextSize(size) {
  const valid = ['small', 'medium', 'large'];
  document.documentElement.setAttribute('data-text-size', valid.includes(size) ? size : 'medium');
}
