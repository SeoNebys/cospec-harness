const captureView = document.querySelector('#captureView');
const detailView = document.querySelector('#detailView');
const saveForm = document.querySelector('#saveForm');
const urlInput = document.querySelector('#urlInput');
const savedUrl = document.querySelector('#savedUrl');
const saveButton = document.querySelector('#saveButton');
const updateButton = document.querySelector('#updateButton');
const backButton = document.querySelector('#backButton');
const toast = document.querySelector('#toast');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 1800);
}

saveForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!saveForm.reportValidity()) return;

  saveButton.disabled = true;
  saveButton.textContent = 'Finding details…';

  window.setTimeout(() => {
    savedUrl.textContent = urlInput.value;
    captureView.hidden = true;
    detailView.hidden = false;
    saveButton.disabled = false;
    saveButton.textContent = 'Save bookmark';
    document.querySelector('#titleInput').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 650);
});

updateButton.addEventListener('click', () => showToast('Changes saved'));

backButton.addEventListener('click', () => {
  detailView.hidden = true;
  captureView.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  urlInput.focus();
});
