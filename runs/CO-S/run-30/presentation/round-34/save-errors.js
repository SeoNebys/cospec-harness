const form = document.querySelector('#invalid-form');
const input = document.querySelector('#url');
const error = document.querySelector('#url-error');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  input.classList.add('invalid');
  input.setAttribute('aria-invalid', 'true');
  error.hidden = false;
  input.focus();
});
