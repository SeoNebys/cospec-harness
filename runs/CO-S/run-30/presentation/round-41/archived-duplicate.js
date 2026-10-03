document.querySelector('#archived-duplicate-form').addEventListener('submit', (event) => {
  event.preventDefault();
  document.querySelector('#archived-notice').hidden = false;
  document.querySelector('#restore-update').focus();
});

document.querySelector('#keep-archived').addEventListener('click', () => {
  document.querySelector('#archived-notice').hidden = true;
});
