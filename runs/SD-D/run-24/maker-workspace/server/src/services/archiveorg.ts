// Internet Archive (Wayback) integration — best-effort, degrades gracefully.

export interface WaybackLookup {
  wayback_url: string | null;
  reachable: boolean;
}

/** Look up the most recent snapshot for a URL. */
export async function findSnapshot(rawUrl: string): Promise<WaybackLookup> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(rawUrl)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return { wayback_url: null, reachable: true };
    const data = (await res.json()) as {
      archived_snapshots?: { closest?: { url?: string; available?: boolean } };
    };
    const closest = data.archived_snapshots?.closest;
    return {
      wayback_url: closest?.available && closest.url ? closest.url : null,
      reachable: true,
    };
  } catch {
    return { wayback_url: null, reachable: false };
  }
}

/** Request that a page be archived. Returns true if the request was accepted. */
export async function requestSnapshot(rawUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`https://web.archive.org/save/${rawUrl}`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}
