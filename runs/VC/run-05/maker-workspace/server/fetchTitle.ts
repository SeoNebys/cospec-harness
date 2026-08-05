// Best-effort fetch of a page's <title>. Returns "" on any failure so the
// caller can fall back to a user-entered title.
export async function fetchPageTitle(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "bookmark-manager/0.1 (+title-fetch)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return "";

    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return "";

    // Only read the first chunk — the <title> lives in <head>.
    const html = (await res.text()).slice(0, 100_000);
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) return "";
    return decodeEntities(match[1].trim()).slice(0, 300);
  } catch {
    return "";
  }
}

function decodeEntities(s: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => named[name.toLowerCase()] ?? m);
}
