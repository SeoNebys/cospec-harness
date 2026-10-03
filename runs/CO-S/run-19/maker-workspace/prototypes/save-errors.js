const params = new URLSearchParams(window.location.search);
const errorCase = params.get('case') === 'unreachable' ? 'unreachable' : 'invalid';
const form = document.querySelector('#error-save-form');
const input = document.querySelector('#error-url');
const button = document.querySelector('#error-save-button');
const control = document.querySelector('#error-url-control');
const panel = document.querySelector('#manual-panel');
const scrim = document.querySelector('#manual-scrim');

document.querySelector('#error-hint').textContent = errorCase === 'invalid'
  ? 'Try: this is not a link'
  : 'Try: https://members.example.com/research/notes';

function isCompleteAddress(value) {
  try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; }
  catch { return false; }
}

function showInvalid() {
  document.querySelector('.error-save-panel').classList.add('invalid');
  control.classList.add('invalid');
  document.querySelector('#url-error').hidden = false;
  document.querySelector('#fetch-error').hidden = true;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!isCompleteAddress(value)) { showInvalid(); return; }
  document.querySelector('.error-save-panel').classList.remove('invalid');
  control.classList.remove('invalid');
  document.querySelector('#url-error').hidden = true;
  button.disabled = true;
  button.textContent = 'Getting details…';
  window.setTimeout(() => {
    button.disabled = false;
    button.textContent = 'Save bookmark';
    document.querySelector('#fetch-error').hidden = false;
  }, 550);
});

input.addEventListener('input', () => { control.classList.remove('invalid'); document.querySelector('.error-save-panel').classList.remove('invalid'); document.querySelector('#url-error').hidden = true; });
document.querySelector('#retry-fetch').addEventListener('click', () => form.requestSubmit());
function closePanel() { panel.hidden = true; scrim.hidden = true; }
document.querySelector('#manual-entry').addEventListener('click', () => { panel.hidden = false; scrim.hidden = false; document.querySelector('#manual-title').focus(); });
document.querySelector('#close-manual-panel').addEventListener('click', closePanel);
document.querySelector('#cancel-manual').addEventListener('click', closePanel);
scrim.addEventListener('click', closePanel);
document.querySelector('#manual-form').addEventListener('submit', (event) => {
  event.preventDefault();
  document.querySelector('#manual-card-title').textContent = document.querySelector('#manual-title').value;
  document.querySelector('#manual-card-description').textContent = document.querySelector('#manual-description').value;
  document.querySelector('#manual-bookmark').hidden = false;
  document.querySelector('#error-count').textContent = '3';
  document.querySelector('#error-list-count').textContent = '3 bookmarks';
  closePanel();
  const toast = document.querySelector('#manual-toast'); toast.hidden = false; window.setTimeout(() => { toast.hidden = true; }, 2400);
});
