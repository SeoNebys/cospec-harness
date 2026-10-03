const form = document.querySelector('#label-form');
const button = document.querySelector('#save-button');
const labelInput = document.querySelector('#label');
const emptyState = document.querySelector('#empty-state');
const bookmarkLink = document.querySelector('#bookmark-link');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  button.disabled = true;
  button.textContent = 'Getting details…';
  window.setTimeout(() => {
    document.querySelector('#saved-label').textContent = labelInput.value.trim() || 'Unlabelled';
    emptyState.hidden = true;
    bookmarkLink.hidden = false;
    document.querySelector('#count').textContent = '1 bookmark';
    button.textContent = 'Saved';
  }, 500);
});
