const compact = document.querySelector('[data-option="compact"]');
compact.querySelector('.expand').addEventListener('click', event => {
  compact.classList.toggle('expanded');
  compact.classList.add('selected');
  event.currentTarget.textContent = compact.classList.contains('expanded') ? 'Show less' : 'Show more';
});

const details = document.querySelector('[data-option="details"]');
details.querySelector('.open-details').addEventListener('click', () => {
  details.querySelector('.detail-panel').hidden = false;
  details.classList.add('selected');
});
details.querySelector('.close').addEventListener('click', () => {
  details.querySelector('.detail-panel').hidden = true;
});
