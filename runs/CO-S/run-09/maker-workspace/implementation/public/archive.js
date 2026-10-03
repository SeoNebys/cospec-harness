const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const id = new URLSearchParams(location.search).get('id');
const reader = document.querySelector('#reader');

try {
  if (!id) throw new Error('No saved copy was selected.');
  const response = await fetch(`/api/bookmarks/${encodeURIComponent(id)}/archive`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Readable copy could not be opened.');
  const { bookmark, archive } = payload;
  document.title = `Saved copy — ${bookmark.title}`;
  document.querySelector('#source').textContent = `${bookmark.source} · original page unavailable`;
  document.querySelector('#capture-detail').textContent = `Captured ${new Date(archive.capturedAt).toLocaleString()} · Original page unavailable`;
  reader.innerHTML = `
    <div class="source-line">${escapeHtml(bookmark.source)} · Offline copy</div>
    <h1>${escapeHtml(bookmark.title)}</h1>
    <p class="description">${escapeHtml(bookmark.description)}</p>
    <div class="meta">Saved in Trove · ${archive.body.length} readable sections</div>
    <article class="article-body">${archive.body.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('')}</article>`;
  reader.dataset.harnessReady = 'true';
} catch (error) {
  reader.innerHTML = `<div class="reader-error">${escapeHtml(error.message)}</div>`;
}
