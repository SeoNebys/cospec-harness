document.querySelector('#restore-button').addEventListener('click', () => {
  document.querySelector('#archived-card').hidden = true;
  document.querySelector('#count').textContent = '0 bookmarks';
  document.querySelector('#archive-count').textContent = '0';
  document.querySelector('#restore-notice').hidden = false;
  document.querySelector('#archive-empty').hidden = false;
});
