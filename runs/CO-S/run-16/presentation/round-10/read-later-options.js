document.querySelectorAll('.option').forEach(option => {
  const menuToggle = option.querySelector('.menu-toggle');
  const menu = option.querySelector('.menu');
  if (menuToggle) menuToggle.addEventListener('click', () => { menu.hidden = !menu.hidden; });
  option.addEventListener('click', event => {
    const mark = event.target.closest('.mark');
    if (!mark) return;
    mark.classList.add('marked');
    if (mark.classList.contains('text-action')) mark.textContent = '✓ In Read later';
    if (menu) menu.hidden = true;
    option.querySelector('.later-count').textContent = '1';
    option.querySelector('.confirmation').hidden = false;
    option.classList.add('selected');
  });
});
