const form = document.querySelector('#save-form');
const button = document.querySelector('#save-button');
const input = document.querySelector('#url');
const emptyState = document.querySelector('#empty-state');
const card = document.querySelector('#bookmark-card');
const count = document.querySelector('#count');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  button.disabled = true;
  button.textContent = 'Getting details…';

  window.setTimeout(() => {
    emptyState.hidden = true;
    card.hidden = false;
    count.textContent = '1 bookmark';
    button.textContent = 'Saved';
    input.disabled = true;
  }, 650);
});
