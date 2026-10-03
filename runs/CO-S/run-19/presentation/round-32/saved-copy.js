const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') === 'panel' ? 'panel' : 'page';
const library = document.querySelector('#library-view');
const reader = document.querySelector('#reader-view');
const panel = document.querySelector('#copy-panel');
const scrim = document.querySelector('#copy-scrim');

function openCopy() {
  if (mode === 'page') {
    library.hidden = true;
    reader.hidden = false;
    window.scrollTo(0, 0);
  } else {
    panel.hidden = false;
    scrim.hidden = false;
  }
}

function closeCopy() {
  library.hidden = false;
  reader.hidden = true;
  panel.hidden = true;
  scrim.hidden = true;
}

document.querySelector('.open-copy').addEventListener('click', openCopy);
document.querySelector('#back-to-library').addEventListener('click', closeCopy);
document.querySelector('#close-copy-panel').addEventListener('click', closeCopy);
scrim.addEventListener('click', closeCopy);
