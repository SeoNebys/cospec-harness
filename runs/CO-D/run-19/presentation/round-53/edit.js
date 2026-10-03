const mode = new URLSearchParams(window.location.search).get('mode') || 'inline';
const editButton = document.querySelector('#edit-button');
const display = document.querySelector('#bookmark-display');
const inlineForm = document.querySelector('#inline-form');
const modal = document.querySelector('#edit-modal');
const drawer = document.querySelector('#edit-drawer');
const toast = document.querySelector('#toast');

const forms = {
  inline: inlineForm,
  modal: document.querySelector('#modal-form'),
  drawer: document.querySelector('#drawer-form')
};

function openEditor() {
  if (mode === 'inline') {
    display.hidden = true;
    inlineForm.hidden = false;
    document.querySelector('#inline-title').focus();
  } else if (mode === 'modal') {
    modal.hidden = false;
    document.querySelector('#modal-title').focus();
  } else {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.querySelector('#drawer-title').focus();
  }
}

function closeEditor() {
  inlineForm.hidden = true;
  display.hidden = false;
  modal.hidden = true;
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  editButton.focus();
}

function saveEditor(event) {
  event.preventDefault();
  const form = event.currentTarget;
  document.querySelector('#shown-title').textContent = form.querySelector('input').value;
  document.querySelector('#shown-description').textContent = form.querySelector('textarea').value;
  closeEditor();
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2400);
}

editButton.addEventListener('click', openEditor);
Object.values(forms).forEach((form) => form.addEventListener('submit', saveEditor));
document.querySelectorAll('.cancel-edit').forEach((button) => button.addEventListener('click', closeEditor));
