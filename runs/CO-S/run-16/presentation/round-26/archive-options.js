document.querySelectorAll('.option').forEach(option => {
  const menuToggle = option.querySelector('.menu-toggle');
  const menu = option.querySelector('.menu');
  if (menuToggle) menuToggle.addEventListener('click', () => { menu.hidden = !menu.hidden; });

  const checkbox = option.querySelector('.select-card');
  const toolbar = option.querySelector('.toolbar-archive');
  if (checkbox) checkbox.addEventListener('change', () => { toolbar.disabled = !checkbox.checked; });

  option.addEventListener('click', event => {
    const archive = event.target.closest('.archive');
    if (!archive || archive.disabled) return;
    if (menu) menu.hidden = true;
    option.classList.add('selected');
    option.querySelector('.all-count').textContent = '0';
    option.querySelector('.archive-count').textContent = '1';
    option.querySelector('.empty').hidden = false;
    option.querySelector('.confirmation').hidden = false;
  });
});
