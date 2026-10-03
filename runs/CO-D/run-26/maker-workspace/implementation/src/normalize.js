// URL normalization, identity, and input validation.
// Two links are the "same" bookmark when their normalized key matches:
// ignoring scheme differences is NOT done (http vs https kept), but we ignore
// a leading "www.", a trailing slash, and letter case of host — matching the
// approved behaviour in SCN-003.

export function normalizeInput(raw) {
  let s = (raw || "").trim();
  if (!s) return { ok: false, reason: "Enter a link first." };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    if (/\s/.test(s) || !/\./.test(s)) {
      return { ok: false, reason: "That doesn't look like a link — check it and try again." };
    }
    s = "https://" + s;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, reason: "Only web links (http or https) can be saved." };
    }
  } catch {
    return { ok: false, reason: "That doesn't look like a link — check it and try again." };
  }
  return { ok: true, url: s };
}

export function urlKey(u) {
  try {
    const x = new URL(u);
    const host = x.hostname.replace(/^www\./i, "").toLowerCase();
    const path = x.pathname.replace(/\/+$/, "");
    return (host + path + x.search).toLowerCase();
  } catch {
    return String(u || "").trim().replace(/\/+$/, "").toLowerCase();
  }
}

export function isPdf(url) {
  return /\.pdf($|[?#])/i.test(url || "");
}
