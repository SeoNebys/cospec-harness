const TRACKING_KEYS = new Set([
  "fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid",
  "igshid", "vero_conv", "vero_id", "wickedid", "yclid"
]);

export function completeWebUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) throw new Error("A web address is required.");
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function parseWebUrl(value) {
  let parsed;
  try {
    parsed = new URL(completeWebUrl(value));
  } catch {
    throw new Error("Enter a complete web address, such as example.com/article.");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname.includes(".") || /\s/.test(parsed.hostname)) {
    throw new Error("Enter a complete web address, such as example.com/article.");
  }
  parsed.hash = "";
  return parsed;
}

export function normalizeUrl(value) {
  const url = parseWebUrl(value);
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (lower.startsWith("utm_") || TRACKING_KEYS.has(lower)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  const query = url.searchParams.toString();
  return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname === "/" ? "" : url.pathname}${query ? `?${query}` : ""}`;
}

export function cleanUrl(value) {
  return parseWebUrl(value).toString();
}

export function siteName(value) {
  return parseWebUrl(value).hostname.replace(/^www\./, "");
}
