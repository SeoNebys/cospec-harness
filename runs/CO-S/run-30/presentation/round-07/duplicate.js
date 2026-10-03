const form = document.querySelector('#duplicate-form');
const dialog = document.querySelector('#duplicate-dialog');
const inlineNotice = document.querySelector('#inline-duplicate');
const useInline = new URLSearchParams(window.location.search).get('style') === 'inline';

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (useInline) {
    inlineNotice.hidden = false;
    inlineNotice.querySelector('.update-button').focus();
  } else {
    dialog.hidden = false;
    document.querySelector('#confirm-update').focus();
  }
});

document.querySelector('#cancel-update').addEventListener('click', () => { dialog.hidden = true; });
document.querySelector('#confirm-update').addEventListener('click', () => {
  dialog.hidden = true;
  document.querySelector('.saved-note').textContent = 'Updated just now';
});

inlineNotice.querySelector('.quiet-button').addEventListener('click', () => { inlineNotice.hidden = true; });
inlineNotice.querySelector('.update-button').addEventListener('click', () => {
  inlineNotice.hidden = true;
  document.querySelector('.saved-note').textContent = 'Updated just now';
});
