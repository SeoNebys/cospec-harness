const form = document.querySelector('#existing-label-form');
const input = document.querySelector('#existing-label');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const label = input.value.trim();
  if (!label) return;
  document.querySelector('#saved-label').textContent = label;
  document.querySelector('#tag-row').hidden = false;
  form.hidden = true;
});
