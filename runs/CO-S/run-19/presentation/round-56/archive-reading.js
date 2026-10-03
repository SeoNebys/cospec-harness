const card = document.querySelector('#cross-octopus');
let section = 'later';
let archived = false;
let inLater = true;

function showToast(text) { document.querySelector('#cross-toast-text').textContent = text; const toast = document.querySelector('#cross-toast'); toast.hidden = false; window.setTimeout(() => { toast.hidden = true; }, 2300); }

function render() {
  const headings = { all: ['LIBRARY','All bookmarks','Newest first'], later: ['QUEUE','Read later','Ready when you are'], archive: ['TUCKED AWAY','Archive','Safely tucked away'] };
  const [label, heading, note] = headings[section];
  document.querySelector('#cross-label').textContent = label;
  document.querySelector('#cross-heading').textContent = heading;
  document.querySelector('#cross-note').textContent = note;
  document.querySelector('#cross-all-nav').classList.toggle('active', section === 'all');
  document.querySelector('#cross-later-nav').classList.toggle('active', section === 'later');
  document.querySelector('#cross-archive-nav').classList.toggle('active', section === 'archive');
  document.querySelector('#cross-later-count').textContent = inLater ? '1' : '0';
  document.querySelector('#cross-archive-count').textContent = archived ? '1' : '0';
  const visible = section === 'all' ? !archived : section === 'later' ? inLater : archived;
  card.hidden = !visible;
  document.querySelector('#cross-list').hidden = !visible;
  document.querySelector('#cross-empty').hidden = visible;
  document.querySelector('#cross-result-count').textContent = `${visible ? 1 : 0} ${visible ? 'bookmark' : 'bookmarks'}`;
  document.querySelector('#mark-read').hidden = section !== 'later';
  document.querySelector('#cross-menu-wrap').hidden = section !== 'later';
  document.querySelector('#cross-restore').hidden = section !== 'archive';
  if (!visible) {
    document.querySelector('#cross-empty-title').textContent = section === 'later' ? 'You’re all caught up' : section === 'archive' ? 'Archive is empty' : 'No everyday bookmarks';
    document.querySelector('#cross-empty-copy').textContent = section === 'later' ? 'The archived bookmark is no longer pending.' : 'Nothing is stored in this section.';
  }
}

function setSection(next) { section = next; render(); }
document.querySelector('#cross-all-nav').addEventListener('click', (event) => { event.preventDefault(); setSection('all'); });
document.querySelector('#cross-later-nav').addEventListener('click', (event) => { event.preventDefault(); setSection('later'); });
document.querySelector('#cross-archive-nav').addEventListener('click', (event) => { event.preventDefault(); setSection('archive'); });
document.querySelector('.menu-trigger').addEventListener('click', (event) => { const menu = event.currentTarget.nextElementSibling; menu.hidden = !menu.hidden; });
document.querySelector('#archive-from-later').addEventListener('click', () => { archived = true; inLater = false; showToast('Moved to Archive and removed from Read later'); render(); });
document.querySelector('#cross-restore').addEventListener('click', () => { archived = false; showToast('Restored to All bookmarks · not added to Read later'); render(); });

render();
