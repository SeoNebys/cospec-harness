const examples = [
  { title: 'CSS grid layout', source: 'developer.mozilla.org', tag: 'Development' },
  { title: 'Designing better empty states', source: 'uxdesign.cc', tag: 'Design' },
  { title: 'A quiet weekend in Copenhagen', source: 'afar.com', tag: 'Design' }
];

function renderOption(option, activeTag = '') {
  const filtered = activeTag ? examples.filter(item => item.tag === activeTag) : examples;
  option.querySelector('.items').innerHTML = filtered.map(item => `
    <article class="item"><div class="thumb"></div><div><h3>${item.title}</h3><p>${item.source}</p><span class="tag">${item.tag}</span></div></article>
  `).join('');
  option.querySelector('.status').textContent = activeTag
    ? `${filtered.length} bookmarks tagged “${activeTag}”`
    : `${filtered.length} bookmarks`;
  option.querySelectorAll('[data-tag]').forEach(button => button.classList.toggle('active', button.dataset.tag === activeTag));
  option.classList.toggle('selected', Boolean(activeTag));
  const toggle = option.querySelector('.filter-toggle');
  if (toggle) toggle.classList.toggle('active', Boolean(activeTag));
}

document.querySelectorAll('.option').forEach(option => {
  let activeTag = '';
  renderOption(option);
  option.addEventListener('click', event => {
    const tagButton = event.target.closest('[data-tag]');
    if (!tagButton) return;
    activeTag = activeTag === tagButton.dataset.tag ? '' : tagButton.dataset.tag;
    renderOption(option, activeTag);
    const popover = option.querySelector('.filter-popover');
    if (popover) popover.hidden = true;
  });
  const toggle = option.querySelector('.filter-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const popover = option.querySelector('.filter-popover');
      popover.hidden = !popover.hidden;
    });
  }
});
