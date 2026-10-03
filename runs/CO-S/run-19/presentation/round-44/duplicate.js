const form = document.querySelector('#duplicate-form');
const notice = document.querySelector('#duplicate-notice');
const existing = document.querySelector('#existing-bookmark');
const input = document.querySelector('#duplicate-url');

function revealExisting() {
  existing.classList.add('duplicate-highlight');
  existing.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!input.checkValidity()) { input.reportValidity(); return; }
  notice.hidden = false;
  revealExisting();
});

document.querySelector('#show-existing').addEventListener('click', revealExisting);
