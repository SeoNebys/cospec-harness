const params = new URLSearchParams(window.location.search);
const directButton = document.querySelector('#archive-button');
const menuWrap = document.querySelector('#menu-wrap');
const menuButton = document.querySelector('#menu-button');
const actionMenu = document.querySelector('#action-menu');

function archiveBookmark() {
  document.querySelector('#mdn-card').hidden = true;
  document.querySelector('#count').textContent = '1 bookmark';
  document.querySelector('#archive-count').textContent = '1';
  document.querySelector('#archive-notice').hidden = false;
}

if (params.get('style') === 'menu') {
  directButton.hidden = true;
  menuWrap.hidden = false;
  if (params.get('open') === '1') actionMenu.hidden = false;
  menuButton.addEventListener('click', () => { actionMenu.hidden = !actionMenu.hidden; });
  document.querySelector('#menu-archive').addEventListener('click', archiveBookmark);
} else {
  directButton.addEventListener('click', archiveBookmark);
}
