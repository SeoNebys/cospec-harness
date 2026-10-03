const params = new URLSearchParams(window.location.search);
const badge = document.querySelector('#status-badge');
const button = document.querySelector('#status-button');
const checkboxControl = document.querySelector('#checkbox-control');
const checkbox = document.querySelector('#read-checkbox');

function markRead(isRead) {
  badge.textContent = isRead ? 'Read' : 'Read later';
  badge.classList.toggle('read', isRead);
  button.textContent = isRead ? 'Mark unread' : 'Mark as read';
}

if (params.get('style') === 'checkbox') {
  button.hidden = true;
  checkboxControl.hidden = false;
  checkbox.addEventListener('change', () => markRead(checkbox.checked));
} else {
  button.addEventListener('click', () => markRead(!badge.classList.contains('read')));
}
