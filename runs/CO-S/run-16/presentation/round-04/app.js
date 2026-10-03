const modal = document.querySelector('#modal');
const form = document.querySelector('#bookmark-form');
const urlInput = document.querySelector('#url');
const emptyState = document.querySelector('#empty-state');
const bookmarkList = document.querySelector('#bookmark-list');
const toast = document.querySelector('#toast');
const totalLabel = document.querySelector('#total-label');
const navCount = document.querySelector('#nav-count');

function openModal() {
  modal.hidden = false;
  window.setTimeout(() => urlInput.select(), 0);
}

function closeModal() {
  modal.hidden = true;
}

document.querySelector('#add-top').addEventListener('click', openModal);
document.querySelector('#close-modal').addEventListener('click', closeModal);
document.querySelector('#cancel-modal').addEventListener('click', closeModal);

modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const saveButton = document.querySelector('#save-button');
  saveButton.disabled = true;
  saveButton.textContent = 'Getting page details…';

  window.setTimeout(() => {
    closeModal();
    emptyState.hidden = true;
    bookmarkList.hidden = false;
    totalLabel.textContent = '1 bookmark';
    navCount.textContent = '1';
    saveButton.disabled = false;
    saveButton.textContent = 'Save bookmark';
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3200);
  }, 650);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) closeModal();
});
