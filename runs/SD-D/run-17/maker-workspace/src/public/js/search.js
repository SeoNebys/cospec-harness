// Search box wiring (FR-009/010/011/012). Sends the raw query to the server,
// which parses the grammar and reports malformed queries.
import { state, reload } from './state.js';

export function initSearch() {
  const input = document.getElementById('search');
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.q = input.value.trim();
      state.page = 1;
      reload();
    }, 250);
  });
}
