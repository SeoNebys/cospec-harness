const form = document.querySelector('#fetch-form');
const button = document.querySelector('#save-button');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  button.disabled = true;
  button.textContent = 'Getting details…';
  window.setTimeout(() => {
    button.disabled = false;
    button.textContent = 'Try again';
    document.querySelector('#fetch-error').hidden = false;
  }, 550);
});
