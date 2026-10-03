const form = document.querySelector('#save-form');
const input = document.querySelector('#url-input');
const button = document.querySelector('#save-button');
const emptyState = document.querySelector('#empty-state');
const savedState = document.querySelector('#saved-state');
const bookmarkCount = document.querySelector('#bookmark-count');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!input.checkValidity()) {
    input.reportValidity();
    return;
  }

  button.disabled = true;
  button.textContent = 'Getting details…';

  window.setTimeout(() => {
    emptyState.hidden = true;
    savedState.hidden = false;
    bookmarkCount.textContent = '1';
    button.disabled = false;
    button.textContent = 'Save bookmark';
    input.value = '';
  }, 650);
});
