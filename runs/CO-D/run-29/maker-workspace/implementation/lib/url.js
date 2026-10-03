const TRACKING_NAMES = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid',
  'ref_src', 'ref_url'
]);

export function prepareAddress(input) {
  const raw = String(input ?? '').trim();
  if (!raw || /\s/.test(raw)) {
    return { ok: false, message: 'Enter a complete web address, such as https://example.com' };
  }

  let candidate = raw;
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(candidate)) {
    if (!looksLikeHost(candidate)) {
      return { ok: false, message: 'Enter a complete web address, such as https://example.com' };
    }
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || !looksLikeHostname(parsed.hostname)) {
      throw new Error('Unsupported address');
    }
    parsed.username = '';
    parsed.password = '';
    return { ok: true, address: parsed.href };
  } catch {
    return { ok: false, message: 'Enter a complete web address, such as https://example.com' };
  }
}

export function canonicalAddress(input) {
  const prepared = prepareAddress(input);
  if (!prepared.ok) return null;
  const url = new URL(prepared.address);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const port = defaultPort(url.protocol, url.port) ? '' : url.port;
  let pathname = normalizePath(url.pathname);

  const meaningful = [...url.searchParams.entries()]
    .filter(([name]) => !isTrackingName(name))
    .sort(([nameA, valueA], [nameB, valueB]) =>
      nameA.localeCompare(nameB) || valueA.localeCompare(valueB));
  const search = new URLSearchParams(meaningful).toString();

  return `${host}${port ? `:${port}` : ''}${pathname}${search ? `?${search}` : ''}`;
}

export function fallbackTitle(address) {
  const url = new URL(address);
  const path = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, '');
  return path ? `${url.hostname}/${path}` : url.hostname;
}

function looksLikeHost(value) {
  const host = value.split(/[/?#]/, 1)[0].replace(/:\d+$/, '');
  return looksLikeHostname(host);
}

function looksLikeHostname(hostname) {
  if (!hostname || hostname.length > 253) return false;
  if (hostname === 'localhost') return true;
  return hostname.includes('.') && hostname.split('.').every(label =>
    label.length > 0 && label.length <= 63 && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label));
}

function isTrackingName(name) {
  const lower = name.toLowerCase();
  return lower.startsWith('utm_') || TRACKING_NAMES.has(lower);
}

function normalizePath(pathname) {
  const collapsed = pathname.replace(/\/{2,}/g, '/');
  if (collapsed === '/') return '/';
  return collapsed.replace(/\/+$/, '');
}

function defaultPort(protocol, port) {
  return !port || (protocol === 'http:' && port === '80') || (protocol === 'https:' && port === '443');
}
