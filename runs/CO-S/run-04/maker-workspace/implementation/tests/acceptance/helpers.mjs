// Shared helpers for acceptance tests.
// The /api/metadata endpoint is stubbed in the browser so tests are hermetic.

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Route /api/metadata. `entries` maps a URL (or substring) to a metadata object.
// Unknown URLs get a generic success unless opts.failUnknown is set.
export async function routeMetadata(page, entries = {}, opts = {}) {
  await page.route("**/api/metadata**", async (route) => {
    const target = new URL(route.request().url()).searchParams.get("url") || "";
    let meta = entries[target];
    if (!meta) {
      const key = Object.keys(entries).find((k) => target.includes(k));
      if (key) meta = entries[key];
    }
    if (!meta) {
      meta = opts.failUnknown
        ? { error: true, host: hostOf(target) }
        : { error: false, title: "Untitled Page", description: "", image: "", favicon: "", host: hostOf(target) };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(meta) });
  });
}

// Save a link via the top input and wait for the fetch to settle.
export async function saveLink(page, url) {
  await page.fill("#urlInput", url);
  await page.click("#saveBtn");
  // Wait until no card is in the pending state.
  await page.waitForFunction(() => document.querySelectorAll(".card.pending").length === 0);
}
