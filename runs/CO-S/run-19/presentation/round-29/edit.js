const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') === 'panel' ? 'panel' : 'inline';
const editButton = document.querySelector('#edit-button');
const inlineForm = document.querySelector('#inline-form');
const panelForm = document.querySelector('#panel-form');
const viewContent = document.querySelector('#view-content');
const editPanel = document.querySelector('#edit-panel');
const scrim = document.querySelector('#scrim');
const closePanelButton = document.querySelector('#close-panel');
const toast = document.querySelector('#edit-toast');

function openEditor() {
  if (mode === 'inline') {
    viewContent.hidden = true;
    inlineForm.hidden = false;
    document.querySelector('#inline-title').focus();
  } else {
    scrim.hidden = false;
    editPanel.hidden = false;
    document.querySelector('#panel-title').focus();
  }
}

function closeEditor() {
  viewContent.hidden = false;
  inlineForm.hidden = true;
  scrim.hidden = true;
  editPanel.hidden = true;
}

function saveDetails(form) {
  const data = new FormData(form);
  const title = data.get('title').trim();
  const description = data.get('description').trim();
  if (!title || !description) return;

  document.querySelector('#display-title').textContent = title;
  document.querySelector('#display-description').textContent = description;
  document.querySelector('#inline-title').value = title;
  document.querySelector('#inline-description').value = description;
  document.querySelector('#panel-title').value = title;
  document.querySelector('#panel-description').value = description;
  closeEditor();
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 2500);
}

editButton.addEventListener('click', openEditor);
inlineForm.addEventListener('submit', (event) => { event.preventDefault(); saveDetails(inlineForm); });
panelForm.addEventListener('submit', (event) => { event.preventDefault(); saveDetails(panelForm); });
document.querySelectorAll('.cancel-edit').forEach((button) => button.addEventListener('click', closeEditor));
closePanelButton.addEventListener('click', closeEditor);
scrim.addEventListener('click', closeEditor);
