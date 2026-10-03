const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') === 'inline' ? 'inline' : 'dialog';
const cards = [...document.querySelectorAll('.delete-card')];
const dialog = document.querySelector('#delete-dialog');
let pendingCard = null;
let section = 'all';

function render() {
  const remaining = cards.filter((card) => card.dataset.deleted !== 'true');
  document.querySelector('#delete-all-count').textContent = String(remaining.length);
  document.querySelector('#delete-result-count').textContent = section === 'archive' ? '0 bookmarks' : `${remaining.length} ${remaining.length === 1 ? 'bookmark' : 'bookmarks'}`;
  cards.forEach((card) => { card.hidden = section === 'archive' || card.dataset.deleted === 'true'; });
  document.querySelector('#delete-list').hidden = section === 'archive';
  document.querySelector('#delete-empty').hidden = section !== 'archive';
}

function removeCard(card) {
  card.dataset.deleted = 'true';
  document.querySelectorAll('.card-menu').forEach((menu) => { menu.hidden = true; });
  const toast = document.querySelector('#deletion-toast');
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 2400);
  render();
}

function requestDelete(card, action) {
  if (mode === 'dialog') {
    pendingCard = card;
    document.querySelector('#delete-bookmark-title').textContent = card.querySelector('h2').textContent;
    dialog.showModal();
    return;
  }
  if (action.dataset.confirming === 'true') {
    removeCard(card);
  } else {
    action.dataset.confirming = 'true';
    action.closest('.card-menu').classList.add('confirming');
    action.querySelector('.delete-action-text').textContent = 'Click again to delete forever';
  }
}

document.querySelectorAll('.menu-trigger').forEach((button) => button.addEventListener('click', () => {
  const menu = button.nextElementSibling;
  document.querySelectorAll('.card-menu').forEach((other) => { if (other !== menu) other.hidden = true; });
  menu.hidden = !menu.hidden;
}));
document.querySelectorAll('.delete-action').forEach((action) => action.addEventListener('click', () => requestDelete(action.closest('.delete-card'), action)));
document.querySelector('#confirm-delete').addEventListener('click', (event) => { event.preventDefault(); dialog.close(); if (pendingCard) removeCard(pendingCard); pendingCard = null; });
document.querySelector('#delete-all-nav').addEventListener('click', (event) => { event.preventDefault(); section = 'all'; document.querySelector('#delete-all-nav').classList.add('active'); document.querySelector('#delete-archive-nav').classList.remove('active'); document.querySelector('#delete-label').textContent = 'LIBRARY'; document.querySelector('#delete-heading').textContent = 'All bookmarks'; render(); });
document.querySelector('#delete-archive-nav').addEventListener('click', (event) => { event.preventDefault(); section = 'archive'; document.querySelector('#delete-all-nav').classList.remove('active'); document.querySelector('#delete-archive-nav').classList.add('active'); document.querySelector('#delete-label').textContent = 'TUCKED AWAY'; document.querySelector('#delete-heading').textContent = 'Archive'; render(); });
document.querySelector('#delete-back-all').addEventListener('click', () => document.querySelector('#delete-all-nav').click());

render();
