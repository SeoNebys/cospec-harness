const form = document.querySelector('#save-form');
const urlInput = document.querySelector('#url');
const emptyState = document.querySelector('#empty-state');
const list = document.querySelector('#bookmark-list');
const count = document.querySelector('#count');
const toast = document.querySelector('#toast');
const template = document.querySelector('#bookmark-template');

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const button = form.querySelector('button');
  button.disabled = true;
  button.textContent = 'Getting page details…';

  window.setTimeout(() => {
    const url = new URL(urlInput.value);
    const card = template.content.cloneNode(true);
    const link = card.querySelector('.bookmark-url');
    const bookmarkCard = card.querySelector('.bookmark-card');
    const display = card.querySelector('.bookmark-display');
    const editForm = card.querySelector('.card-edit-form');
    const editButton = card.querySelector('.card-edit-button');
    const cancelButton = card.querySelector('.cancel-card-edit');
    link.textContent = url.href;
    link.href = url.href;

    const openOriginal = () => window.open(url.href, '_blank', 'noopener,noreferrer');
    bookmarkCard.addEventListener('click', (clickEvent) => {
      if (clickEvent.target.closest('a, button, input, textarea, form')) return;
      openOriginal();
    });
    bookmarkCard.addEventListener('keydown', (keyEvent) => {
      if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') return;
      keyEvent.preventDefault();
      openOriginal();
    });

    editButton.addEventListener('click', () => {
      display.hidden = true;
      editForm.hidden = false;
      editForm.querySelector('.title-input').focus();
    });

    cancelButton.addEventListener('click', () => {
      editForm.hidden = true;
      display.hidden = false;
      editButton.focus();
    });

    editForm.addEventListener('submit', (submitEvent) => {
      submitEvent.preventDefault();
      display.querySelector('h3').textContent = editForm.querySelector('.title-input').value;
      display.querySelector('.description').textContent = editForm.querySelector('.description-input').value;
      editForm.hidden = true;
      display.hidden = false;
      toast.textContent = 'Changes saved.';
      toast.classList.add('show');
      window.setTimeout(() => toast.classList.remove('show'), 2400);
    });

    list.replaceChildren(card);
    emptyState.classList.add('hidden');
    count.textContent = '1 saved';
    button.disabled = false;
    button.textContent = 'Save bookmark';
    urlInput.value = '';
    toast.textContent = 'Bookmark saved — page details added.';
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2600);
  }, 700);
});
