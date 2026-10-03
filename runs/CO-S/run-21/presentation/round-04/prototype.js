const form = document.querySelector('#save-form');
const input = document.querySelector('#url');
const button = document.querySelector('#save-button');
const emptyState = document.querySelector('#empty-state');
const card = document.querySelector('#bookmark-card');
const count = document.querySelector('#count');
const displayUrl = document.querySelector('#display-url');
const bookmarkTitle = document.querySelector('#bookmark-title');
const toast = document.querySelector('#toast');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!input.reportValidity()) return;

  button.disabled = true;
  button.querySelector('span:first-child').textContent = 'Gathering details…';

  window.setTimeout(() => {
    const enteredUrl = input.value;
    emptyState.hidden = true;
    card.hidden = false;
    count.textContent = '1 saved';
    displayUrl.textContent = enteredUrl;
    bookmarkTitle.href = enteredUrl;
    button.disabled = false;
    button.querySelector('span:first-child').textContent = 'Save link';
    toast.hidden = false;
    window.setTimeout(() => { toast.hidden = true; }, 3200);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 850);
});
