const DEFAULT_PORTS: Record<string, string> = { 'http:': '80', 'https:': '443' };

export function normalizeBookmarkUrl(input: string): { url: string; key: string } {
  let value = input.trim();
  if (!/^[a-z][a-z\d+.-]*:/i.test(value)) value = `https://${value}`;
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS links can be saved.');
  if (parsed.username || parsed.password) throw new Error('Links containing credentials cannot be saved.');
  parsed.hostname = parsed.hostname.toLowerCase();
  if (parsed.port === DEFAULT_PORTS[parsed.protocol]) parsed.port = '';
  if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const display = parsed.toString();
  const keyUrl = new URL(display);
  keyUrl.hash = '';
  if (keyUrl.pathname === '/') keyUrl.pathname = '';
  keyUrl.searchParams.sort();
  return { url: display, key: keyUrl.toString() };
}
