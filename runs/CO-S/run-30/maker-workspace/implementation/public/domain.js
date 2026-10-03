export function matchesBookmark(bookmark, query, label = 'all') {
  const normalizedQuery = String(query ?? '').trim().toLocaleLowerCase();
  const text = `${bookmark.title} ${bookmark.description}`.toLocaleLowerCase();
  const matchesText = !normalizedQuery || text.includes(normalizedQuery);
  const matchesLabel = label === 'all' || bookmark.labels.some((item) => item.toLocaleLowerCase() === label.toLocaleLowerCase());
  return matchesText && matchesLabel;
}

export function uniqueLabels(bookmarks) {
  const labels = new Map();
  for (const bookmark of bookmarks) {
    for (const label of bookmark.labels) {
      const key = label.toLocaleLowerCase();
      if (!labels.has(key)) labels.set(key, label);
    }
  }
  return [...labels.values()].sort((a, b) => a.localeCompare(b));
}
