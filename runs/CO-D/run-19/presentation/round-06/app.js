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
    link.textContent = url.href;
    link.href = url.href;

    const openOriginal = () => window.open(url.href, '_blank', 'noopener,noreferrer');
    bookmarkCard.addEventListener('click', (clickEvent) => {
      if (clickEvent.target.closest('a')) return;
      openOriginal();
    });
    bookmarkCard.addEventListener('keydown', (keyEvent) => {
      if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') return;
      keyEvent.preventDefault();
      openOriginal();
    });

    list.replaceChildren(card);
    emptyState.classList.add('hidden');
    count.textContent = '1 saved';
    button.disabled = false;
    button.textContent = 'Save bookmark';
    urlInput.value = '';
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2600);
  }, 700);
});
