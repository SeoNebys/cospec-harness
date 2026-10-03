const manual = document.querySelector('[data-option="manual"]');
manual.querySelector('.refresh').addEventListener('click', event => {
  manual.querySelector('h3').textContent = 'CSS layout cookbook';
  manual.querySelector('.card p').textContent = 'Practical layout patterns you can adapt to common design needs.';
  const preview = manual.querySelector('.preview');
  preview.className = 'preview cookbook';
  preview.textContent = 'Aa';
  const status = manual.querySelector('.status');
  status.className = 'status updated';
  status.textContent = 'Updated from page just now';
  event.currentTarget.textContent = '✓ Details refreshed';
  event.currentTarget.disabled = true;
  manual.querySelector('.confirmation').hidden = false;
  manual.classList.add('selected');
});
