export function updateSearchState(
  current: URLSearchParams,
  changes: Record<string, string | undefined>
) {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes))
    value ? next.set(key, value) : next.delete(key);
  return next;
}
