const captureView = document.querySelector('#captureView');
const libraryView = document.querySelector('#libraryView');
const detailView = document.querySelector('#detailView');
const saveForm = document.querySelector('#saveForm');
const urlInput = document.querySelector('#urlInput');
const savedUrl = document.querySelector('#savedUrl');
const saveButton = document.querySelector('#saveButton');
const updateButton = document.querySelector('#updateButton');
const backButton = document.querySelector('#backButton');
const toast = document.querySelector('#toast');
const directEditButton = document.querySelector('#directEditButton');
const menuEditButton = document.querySelector('#menuEditButton');
const moreButton = document.querySelector('#moreButton');
const actionMenu = document.querySelector('#actionMenu');
const addButton = document.querySelector('#addButton');
const rowTitle = document.querySelector('#rowTitle');
const rowDescription = document.querySelector('#rowDescription');
const titleInput = document.querySelector('#titleInput');
const descriptionInput = document.querySelector('#descriptionInput');

const params = new URLSearchParams(window.location.search);
const editVariant = params.get('edit') === 'direct' ? 'direct' : 'menu';
const defaultUrl = 'https://afar.com/magazine/a-perfect-day-in-rome';

function showView(view) {
  captureView.hidden = view !== captureView;
  libraryView.hidden = view !== libraryView;
  detailView.hidden = view !== detailView;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 1800);
}

function openEditor() {
  savedUrl.value = savedUrl.value || defaultUrl;
  titleInput.value = rowTitle.textContent;
  descriptionInput.value = rowDescription.textContent;
  document.querySelector('.saved-banner').hidden = true;
  showView(detailView);
  titleInput.focus();
}

if (editVariant === 'menu') {
  document.querySelector('.direct-action').hidden = true;
  document.querySelector('.menu-action').hidden = false;
}

if (params.get('mode') === 'library') {
  savedUrl.value = defaultUrl;
  showView(libraryView);
}

saveForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!saveForm.reportValidity()) return;

  saveButton.disabled = true;
  saveButton.textContent = 'Finding details…';

  window.setTimeout(() => {
    savedUrl.value = urlInput.value;
    document.querySelector('.saved-banner').hidden = false;
    showView(detailView);
    saveButton.disabled = false;
    saveButton.textContent = 'Save bookmark';
    titleInput.focus();
  }, 650);
});

updateButton.addEventListener('click', () => {
  if (!savedUrl.reportValidity()) return;
  rowTitle.textContent = titleInput.value;
  rowDescription.textContent = descriptionInput.value;
  document.querySelector('#bookmarkLink').href = savedUrl.value;
  try {
    document.querySelector('.row-url').textContent = new URL(savedUrl.value).hostname.replace(/^www\./, '');
  } catch {
    document.querySelector('.row-url').textContent = savedUrl.value;
  }
  showToast('Changes saved');
});

backButton.addEventListener('click', () => showView(libraryView));

addButton.addEventListener('click', () => {
  showView(captureView);
  urlInput.focus();
});

directEditButton.addEventListener('click', openEditor);
menuEditButton.addEventListener('click', openEditor);
moreButton.addEventListener('click', () => {
  const willOpen = actionMenu.hidden;
  actionMenu.hidden = !willOpen;
  moreButton.setAttribute('aria-expanded', String(willOpen));
});
