const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') === 'button' ? 'button' : 'menu';
const cards = [...document.querySelectorAll('.archive-card')];
let section = 'all';

document.querySelectorAll('.direct-archive').forEach((button) => { button.hidden = mode !== 'button'; });
document.querySelectorAll('.menu-wrap').forEach((menu) => { menu.hidden = mode !== 'menu'; });

function archivedCards() { return cards.filter((card) => card.dataset.archived === 'true'); }
function showToast(text) { document.querySelector('#archive-toast-text').textContent = text; const toast = document.querySelector('#archive-toast'); toast.hidden = false; window.setTimeout(() => { toast.hidden = true; }, 2200); }

function render() {
  const archived = archivedCards();
  const available = cards.filter((card) => card.dataset.archived !== 'true');
  document.querySelector('#archive-count').textContent = String(archived.length);
  document.querySelector('#all-count').textContent = String(available.length);
  cards.forEach((card) => {
    const isArchived = card.dataset.archived === 'true';
    card.hidden = section === 'archive' ? !isArchived : isArchived;
    card.querySelector('.direct-archive').hidden = section === 'archive' || mode !== 'button';
    card.querySelector('.menu-wrap').hidden = section === 'archive' || mode !== 'menu';
    card.querySelector('.restore-button').hidden = section !== 'archive';
  });
  const shown = section === 'archive' ? archived.length : available.length;
  document.querySelector('#archive-result-count').textContent = `${shown} ${shown === 1 ? 'bookmark' : 'bookmarks'}`;
  document.querySelector('#archive-note').textContent = section === 'archive' ? 'Safely tucked away' : 'Newest first';
  document.querySelector('#archive-list').hidden = shown === 0;
  document.querySelector('#archive-empty').hidden = shown !== 0;
  document.querySelector('#archive-empty-title').textContent = section === 'archive' ? 'Archive is empty' : 'No everyday bookmarks';
  document.querySelector('#archive-empty-copy').textContent = section === 'archive' ? 'Items you tuck away will wait here.' : 'Your archived bookmarks are still safe.';
}

function setSection(next) {
  section = next;
  const archived = next === 'archive';
  document.querySelector('#archive-all-nav').classList.toggle('active', !archived);
  document.querySelector('#archive-nav').classList.toggle('active', archived);
  document.querySelector('#archive-label').textContent = archived ? 'TUCKED AWAY' : 'LIBRARY';
  document.querySelector('#archive-heading').textContent = archived ? 'Archive' : 'All bookmarks';
  render();
}

function archiveCard(card) { card.dataset.archived = 'true'; document.querySelectorAll('.card-menu').forEach((menu) => { menu.hidden = true; }); showToast('Moved to Archive · not deleted'); render(); }
function restoreCard(card) { card.dataset.archived = 'false'; showToast('Restored to All bookmarks'); render(); }

document.querySelector('#archive-all-nav').addEventListener('click', (event) => { event.preventDefault(); setSection('all'); });
document.querySelector('#archive-nav').addEventListener('click', (event) => { event.preventDefault(); setSection('archive'); });
document.querySelector('#archive-back-all').addEventListener('click', () => setSection('all'));
document.querySelectorAll('.direct-archive, .menu-archive').forEach((button) => button.addEventListener('click', () => archiveCard(button.closest('.archive-card'))));
document.querySelectorAll('.restore-button').forEach((button) => button.addEventListener('click', () => restoreCard(button.closest('.archive-card'))));
document.querySelectorAll('.menu-trigger').forEach((button) => button.addEventListener('click', () => { const menu = button.nextElementSibling; document.querySelectorAll('.card-menu').forEach((other) => { if (other !== menu) other.hidden = true; }); menu.hidden = !menu.hidden; }));

render();
