const form = document.querySelector('#failed-save-form');
const card = document.querySelector('#failed-card');
const empty = document.querySelector('#failed-empty');
const toast = document.querySelector('#toast');
const input = document.querySelector('#failed-url');
const urlError = document.querySelector('#url-error');
const scenario = new URLSearchParams(window.location.search).get('case') || 'metadata';

if (scenario === 'invalid') {
  input.type = 'text';
  input.value = 'not a link';
}

function isUsableWebAddress(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!isUsableWebAddress(input.value)) {
    input.setAttribute('aria-invalid', 'true');
    urlError.hidden = false;
    input.focus();
    return;
  }
  input.removeAttribute('aria-invalid');
  urlError.hidden = true;
  const button = form.querySelector('button');
  button.disabled = true;
  button.textContent = 'Getting page details…';
  window.setTimeout(() => {
    card.hidden = false;
    empty.hidden = true;
    document.querySelector('#failed-count').textContent = '1 saved';
    button.disabled = false;
    button.textContent = 'Save bookmark';
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2500);
  }, 800);
});

input.addEventListener('input', () => {
  if (urlError.hidden) return;
  input.removeAttribute('aria-invalid');
  urlError.hidden = true;
});

document.querySelector('#retry-details').addEventListener('click', () => {
  toast.textContent = 'Still unable to reach the page. Your link is safe.';
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2500);
});

document.querySelector('#add-details').addEventListener('click', () => {
  document.querySelector('.metadata-failed h3').textContent = 'Add your own title here';
  document.querySelector('.muted-description').textContent = 'The same in-card editor would open for manual details.';
  toast.textContent = 'Manual details ready to edit.';
  toast.classList.add('show');
});
