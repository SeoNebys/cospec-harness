document.querySelectorAll('.option').forEach(option => {
  const form = option.querySelector('form');
  const button = option.querySelector('.save');
  form.addEventListener('submit', event => {
    event.preventDefault();
    button.classList.add('loading');
    window.setTimeout(() => {
      button.classList.remove('loading');
      option.classList.add('selected');
      if (option.dataset.option === 'block') {
        option.querySelector('.error').hidden = false;
        return;
      }
      form.hidden = true;
      option.querySelector('.result').hidden = false;
    }, 500);
  });
});
