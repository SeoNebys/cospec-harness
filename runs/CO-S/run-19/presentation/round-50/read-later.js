const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') === 'menu' ? 'menu' : 'button';
const cards = [...document.querySelectorAll('.queue-card')];
let section = 'all';

document.querySelectorAll('.direct-later').forEach((button) => { button.hidden = mode !== 'button'; });
document.querySelectorAll('.menu-wrap').forEach((menu) => { menu.hidden = mode !== 'menu'; });

function laterCards() { return cards.filter((card) => card.dataset.later === 'true'); }

function showToast(text) {
  document.querySelector('#queue-toast-text').textContent = text;
  const toast = document.querySelector('#queue-toast');
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 2200);
}

function render() {
  const later = laterCards();
  document.querySelector('#later-count').textContent = String(later.length);
  cards.forEach((card) => {
    const isLater = card.dataset.later === 'true';
    card.hidden = section === 'later' && !isLater;
    card.classList.toggle('in-later', isLater);
    const direct = card.querySelector('.direct-later');
    const menuAction = card.querySelector('.card-menu [data-action="later"]');
    if (section === 'later') {
      direct.innerHTML = '<span aria-hidden="true">✓</span> Mark as read';
      direct.classList.remove('selected');
      menuAction.innerHTML = '<span aria-hidden="true">✓</span> Mark as read';
    } else {
      direct.innerHTML = isLater ? '<span aria-hidden="true">✓</span> In Read later' : '<span aria-hidden="true">◷</span> Read later';
      direct.classList.toggle('selected', isLater);
      menuAction.innerHTML = isLater ? '<span aria-hidden="true">−</span> Remove from Read later' : '<span aria-hidden="true">◷</span> Add to Read later';
    }
  });
  const shown = section === 'later' ? later.length : cards.length;
  document.querySelector('#queue-count').textContent = `${shown} ${shown === 1 ? 'bookmark' : 'bookmarks'}`;
  document.querySelector('#queue-note').textContent = section === 'later' ? 'Ready when you are' : 'Newest first';
  document.querySelector('#queue-list').hidden = section === 'later' && later.length === 0;
  document.querySelector('#queue-empty').hidden = !(section === 'later' && later.length === 0);
}

function setSection(next) {
  section = next;
  const later = next === 'later';
  document.querySelector('#all-nav').classList.toggle('active', !later);
  document.querySelector('#later-nav').classList.toggle('active', later);
  document.querySelector('#section-label').textContent = later ? 'QUEUE' : 'LIBRARY';
  document.querySelector('#section-heading').textContent = later ? 'Read later' : 'All bookmarks';
  render();
}

function toggleLater(card) {
  const wasLater = card.dataset.later === 'true';
  if (section === 'later') {
    card.dataset.later = 'false';
    showToast('Marked as read · bookmark kept');
  } else {
    card.dataset.later = wasLater ? 'false' : 'true';
    showToast(wasLater ? 'Removed from Read later' : 'Added to Read later');
  }
  render();
}

document.querySelector('#all-nav').addEventListener('click', (event) => { event.preventDefault(); setSection('all'); });
document.querySelector('#later-nav').addEventListener('click', (event) => { event.preventDefault(); setSection('later'); });
document.querySelector('#back-to-all').addEventListener('click', () => setSection('all'));
document.querySelectorAll('[data-action="later"]').forEach((button) => button.addEventListener('click', () => {
  toggleLater(button.closest('.queue-card'));
  document.querySelectorAll('.card-menu').forEach((menu) => { menu.hidden = true; });
}));
document.querySelectorAll('.menu-trigger').forEach((button) => button.addEventListener('click', () => {
  const menu = button.nextElementSibling;
  document.querySelectorAll('.card-menu').forEach((other) => { if (other !== menu) other.hidden = true; });
  menu.hidden = !menu.hidden;
}));

render();
