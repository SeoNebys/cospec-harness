import { test, expect } from "@playwright/test";

test.describe.serial("personal bookmark library", () => {
  test("saves a personalized bookmark, formats its note, and catches a normalized duplicate", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
    await expect(page.getByText("Your library is waiting.")).toBeVisible();

    await page.getByRole("button", { name: "Save your first link" }).click();
    await page.locator("#urlInput").fill("not a web address");
    await page.getByRole("button", { name: "Find details" }).click();
    await expect(page.locator("#urlError")).toContainText("complete web address");
    await expect(page.locator("#urlInput")).toHaveValue("not a web address");

    await page.locator("#urlInput").fill("example.com/article?utm_source=newsletter");
    await page.getByRole("button", { name: "Find details" }).click();
    await expect(page.locator("#bookmarkForm")).toBeVisible();
    await expect(page.locator("#titleInput")).toHaveValue("The page title gathered automatically");
    await page.locator("#titleInput").fill("A field guide to ancient libraries");
    await page.locator("#descriptionInput").fill("Ideas about lost collections and why preserving knowledge matters.");
    await page.locator("#labelInput").fill("Architecture");
    await page.locator("#labelInput").press("Enter");
    await page.locator("#labelInput").fill("History");
    await page.locator("#labelInput").press("Enter");
    await page.getByRole("button", { name: "Remove History" }).click();
    await expect(page.locator("#selectedLabels")).toContainText("Architecture");
    await expect(page.locator("#selectedLabels")).not.toContainText("History");

    const note = page.locator("#noteEditor");
    await note.fill("Use this for the museum renovation ideas.");
    await note.press("End");
    await note.press("Enter");
    await page.locator("#bulletButton").click();
    await page.keyboard.type("Museum layouts");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Natural lighting references");
    await page.locator(".switch-track").click();
    await expect(page.locator("#readLaterInput")).toBeChecked();
    await page.getByRole("button", { name: "Save bookmark", exact: true }).click();

    await expect(page.locator(".bookmark-card")).toHaveCount(1);
    await expect(page.locator(".bookmark-card")).toContainText("A field guide to ancient libraries");
    await expect(page.locator(".bookmark-card")).toContainText("Architecture");
    await expect(page.locator(".bookmark-card")).not.toContainText("museum renovation ideas");
    await expect(page.locator("#laterCount")).toHaveText("1");
    await expect(page.locator("#toast")).toContainText("Bookmark saved");

    await expect(page.locator(".bookmark-card h2 a")).toHaveAttribute("target", "_blank");
    const popupPromise = page.waitForEvent("popup");
    await page.locator(".bookmark-card h2 a").click();
    const popup = await popupPromise;
    await popup.close();
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("button", { name: /View details & note/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#noteEditor")).toContainText("Use this for the museum renovation ideas.");
    await expect(page.locator("#noteEditor li")).toHaveCount(2);
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Save a link" }).click();
    await page.locator("#urlInput").fill("https://www.example.com/article/?utm_campaign=again");
    await page.getByRole("button", { name: "Find details" }).click();
    await expect(page.locator("#duplicateBadge")).toBeVisible();
    await expect(page.locator("#titleInput")).toHaveValue("A field guide to ancient libraries");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator(".bookmark-card")).toHaveCount(1);
  });

  test("finds private note words, clears completely, and maintains Read later and Archive", async ({ page }) => {
    await page.goto("/");
    await page.locator("#searchInput").fill("renovation");
    await expect(page.locator(".bookmark-card")).toHaveCount(1);
    await expect(page.locator(".match-reason")).toHaveText("Matched your personal note");
    await expect(page.locator(".bookmark-card")).not.toContainText("museum renovation ideas");
    await page.locator("#clearSearch").click();
    await expect(page.locator("#viewTitle")).toHaveText("All bookmarks");

    await page.getByRole("button", { name: /Read later/ }).click();
    await expect(page.locator(".bookmark-card")).toHaveCount(1);
    await page.locator(".later-button").click();
    await expect(page.getByText("Nothing waiting for you")).toBeVisible();
    await expect(page.locator("#laterCount")).toHaveText("0");
    await page.getByRole("button", { name: "Browse all bookmarks" }).click();

    await page.getByRole("button", { name: /View details & note/ }).click();
    await page.getByRole("button", { name: "Archive bookmark" }).click();
    await expect(page.locator("#archiveCount")).toHaveText("1");
    await page.locator("#searchInput").fill("renovation");
    await expect(page.getByText("No bookmarks found")).toBeVisible();
    await expect(page.locator("#archiveCount")).toHaveText("1");
    await page.locator("#clearSearch").click();
    await page.locator('[data-view="archive"]').click();
    await expect(page.locator(".bookmark-card")).toHaveCount(1);
    await page.getByRole("button", { name: /View details & note/ }).click();
    await expect(page.locator("#noteEditor li")).toHaveCount(2);
    await page.locator("#restoreBookmarkButton").click();
    await expect(page.locator("#archiveCount")).toHaveText("0");
    await expect(page.locator("#viewTitle")).toHaveText("All bookmarks");
  });

  test("imports browser bookmarks, sorts them, combines search options, and scopes batch selection", async ({ page }) => {
    await page.goto("/");
    const browserFile = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><H3>Reading</H3><DL><p>
      <DT><A HREF="https://water.example.com/story" ADD_DATE="1609459200">Why water helps</A>
      <DT><H3>Architecture</H3><DL><p><DT><A HREF="https://museum.example.com/design" ADD_DATE="1640995200">Museum design notes</A></DL><p>
      <DT><A HREF="https://www.example.com/article/?utm_source=duplicate">Duplicate page</A>
      <DT><A HREF="not a url">Broken</A></DL><p></DL><p>`;
    await page.locator("#importFile").setInputFiles({ name: "bookmarks.html", mimeType: "text/html", buffer: Buffer.from(browserFile) });
    await expect(page.locator("#importPreviewView")).toBeVisible();
    await expect(page.locator("#importStats")).toContainText("2");
    await expect(page.locator("#importStats")).toContainText("1");
    await page.locator("#confirmImportButton").click();
    await expect(page.locator(".bookmark-card")).toHaveCount(3);
    await expect(page.locator("#toast")).toContainText("2 imported · 1 already here · 1 skipped");
    const museumCard = page.locator(".bookmark-card").filter({ hasText: "Museum design notes" });
    await expect(museumCard).toContainText("Reading");
    await expect(museumCard).toContainText("Architecture");
    await expect(museumCard).toContainText("Saved Jan 1, 2022");

    await page.locator("#sortSelect").selectOption("name");
    const titles = await page.locator(".bookmark-card h2").allTextContents();
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));

    await page.locator("#searchInput").fill("water museum");
    await page.locator("#searchOptionsButton").click();
    await page.locator("#wordMode").selectOption("any");
    await expect(page.locator(".bookmark-card")).toHaveCount(3);
    await expect(page.locator("#filterChips")).toContainText("Matching: any word");
    await page.locator("#excludeLabel").selectOption("Reading");
    await expect(page.locator(".bookmark-card")).toHaveCount(1);
    await page.locator("#excludeLabel").selectOption("");
    await page.locator("#wordMode").selectOption("all");
    await page.locator("#searchInput").fill("museum");
    await page.locator("#withinLabel").selectOption("Reading");
    await expect(page.locator(".bookmark-card")).toHaveCount(1);
    await expect(page.locator("#filterChips")).toContainText("Within: Reading");
    await page.locator("#withinLabel").selectOption("");
    await page.locator("#excludeWords").fill("renovation");
    await expect(page.locator(".bookmark-card")).toHaveCount(1);
    await expect(page.locator("#filterChips")).toContainText("Leaving out words: renovation");
    await page.locator("#clearSearch").click();
    await expect(page.locator(".bookmark-card")).toHaveCount(3);
    await expect(page.locator("#wordMode")).toHaveValue("all");

    await page.locator('#labelNavItems [data-label-view="Reading"]').click();
    await page.locator("#selectModeButton").click();
    await page.locator("#selectAll").check();
    await expect(page.locator("#selectedCount")).toHaveText("2 selected");
    await page.locator("#bulkLater").click();
    await page.getByRole("button", { name: "Add selected to Read later" }).click();
    await expect(page.locator("#laterCount")).toHaveText("2");
  });

  test("adds a batch label, archives a batch, and guards batch deletion", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-view="all"]').click();
    await page.locator("#selectModeButton").click();
    const checks = page.locator("[data-select-card]");
    await checks.nth(0).check();
    await checks.nth(1).check();
    await page.locator("#bulkLabel").click();
    await page.locator("#bulkLabelInput").fill("Research");
    await page.locator("#applyBulkLabel").click();
    await expect(page.locator(".bookmark-card").filter({ hasText: "Research" })).toHaveCount(2);

    const refreshedChecks = page.locator("[data-select-card]");
    await refreshedChecks.nth(0).check();
    await refreshedChecks.nth(1).check();
    await page.locator("#bulkArchive").click();
    await expect(page.locator("#archiveCount")).toHaveText("2");
    await expect(page.locator(".bookmark-card")).toHaveCount(1);
    await page.locator("#doneSelecting").click();

    await page.locator('[data-view="archive"]').click();
    await page.locator("#selectModeButton").click();
    await page.locator("#selectAll").check();
    await page.locator("#bulkDelete").click();
    await expect(page.locator("#confirmTitle")).toHaveText("Delete 2 bookmarks?");
    await expect(page.locator("#deleteList .delete-list-item")).toHaveCount(2);
    await page.locator("#cancelConfirm").click();
    await expect(page.locator(".bookmark-card")).toHaveCount(2);
    await page.locator("#bulkDelete").click();
    await page.locator("#confirmDeleteButton").click();
    await expect(page.locator("#archiveCount")).toHaveText("0");
    await expect(page.getByText("Archive is empty")).toBeVisible();
  });

  test("downloads both export formats and restores a complete backup", async ({ page }) => {
    await page.goto("/");
    await page.locator("#toolsButton").click();
    await page.getByRole("button", { name: /Export or back up/ }).click();
    await expect(page.getByText("Browser limitation")).toBeVisible();
    const browserDownload = page.waitForEvent("download");
    await page.locator("#browserExportLink").click();
    expect((await browserDownload).suggestedFilename()).toMatch(/^keepsake-bookmarks-\d{4}-\d{2}-\d{2}\.html$/);
    const backupDownloadPromise = page.waitForEvent("download");
    await page.locator("#backupExportLink").click();
    const backupDownload = await backupDownloadPromise;
    expect(backupDownload.suggestedFilename()).toMatch(/^keepsake-library-\d{4}-\d{2}-\d{2}\.json$/);
    const backupPath = await backupDownload.path();
    await page.getByRole("button", { name: "Close" }).click();
    await page.evaluate(async () => {
      await fetch("/api/bookmarks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://temporary.example/item", title: "Temporary bookmark" }) });
    });
    await page.reload();
    await expect(page.locator(".bookmark-card")).toHaveCount(2);
    await page.locator("#importFile").setInputFiles(backupPath);
    await expect(page.locator("#importPreviewTitle")).toContainText("Restore this complete backup");
    await expect(page.locator("#importDetails")).toContainText("replaces the current library");
    await page.locator("#confirmImportButton").click();
    await expect(page.locator(".bookmark-card")).toHaveCount(1);
    await expect(page.locator(".bookmark-card")).toContainText("Why water helps");
  });

  test("falls back to manual details when a page cannot be read", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Save a link" }).click();
    await page.locator("#urlInput").fill("https://unreadable.example/private");
    await page.getByRole("button", { name: "Find details" }).click();
    await expect(page.locator("#metadataNotice")).toContainText("couldn’t read this page");
    await expect(page.locator("#titleInput")).toHaveValue("");
    await expect(page.locator("#editorSite")).toHaveText("unreadable.example");
    await page.locator("#titleInput").fill("A page I still want to keep");
    await page.getByRole("button", { name: "Save bookmark", exact: true }).click();
    await expect(page.locator(".bookmark-card").filter({ hasText: "A page I still want to keep" })).toHaveCount(1);
  });

  test("enforces long-card boundaries and exact phrase matching", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      const create = (body) => fetch("/api/bookmarks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      await create({ url: "https://long.example/item", title: "An extraordinarily long investigation into adaptable museum galleries and the public spaces that make cultural buildings welcoming to everyone", description: "A deliberately long description about flexible interiors, generous entrances, shared civic rooms, daylight, natural materials, public programs, and every other detail needed to test a card boundary without losing the complete saved text.", labels: ["One", "Two", "Three", "Four", "Five", "Six", "Seven"], noteHtml: "<p>Natural lighting belongs together.</p>", savedAt: "2020-01-01T00:00:00.000Z" });
      await create({ url: "https://separate.example/item", title: "Separate words", description: "Natural materials can make a room calmer while careful artificial lighting extends its use.", labels: ["Reading"], savedAt: "2025-01-01T00:00:00.000Z" });
    });
    await page.reload();
    const longCard = page.locator(".bookmark-card").filter({ hasText: "An extraordinarily long investigation" });
    await expect(longCard.locator(".label-chip")).toHaveCount(3);
    await expect(longCard.locator(".more-labels")).toHaveText("+4 more");
    expect(await longCard.locator("h2").evaluate((element) => getComputedStyle(element).webkitLineClamp)).toBe("3");
    await longCard.getByRole("button", { name: /View details & note/ }).click();
    await expect(page.locator("#titleInput")).toHaveValue(/An extraordinarily long investigation/);
    await expect(page.locator("#selectedLabels .selected-label")).toHaveCount(7);
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.locator("#searchInput").fill("natural lighting");
    await expect(page.locator(".bookmark-card")).toHaveCount(2);
    await page.locator("#searchOptionsButton").click();
    await page.locator("#exactPhrase").check();
    await expect(page.locator(".bookmark-card")).toHaveCount(1);
    await expect(page.locator(".bookmark-card")).toContainText("An extraordinarily long investigation");
    await expect(page.locator("#filterChips")).toContainText("Exact phrase");
    await page.locator("#clearSearch").click();
  });

  test("keeps sort order across label and search views and reuses label capitalization", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      const create = (body) => fetch("/api/bookmarks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      await create({ url: "https://sort.example/zeta", title: "Zeta sort target", labels: ["SortGroup"], savedAt: "2019-01-01T00:00:00.000Z" });
      await create({ url: "https://sort.example/alpha", title: "Alpha sort target", labels: ["SortGroup"], savedAt: "2026-01-01T00:00:00.000Z" });
    });
    await page.reload();
    await page.locator("#sortSelect").selectOption("oldest");
    await expect(page.locator(".bookmark-card h2").first()).toHaveText("Zeta sort target");
    await page.locator('#labelNavItems [data-label-view="SortGroup"]').click();
    await expect(page.locator("#sortSelect")).toHaveValue("oldest");
    await expect(page.locator(".bookmark-card h2").first()).toHaveText("Zeta sort target");
    await page.locator("#searchInput").fill("sort target");
    await expect(page.locator(".bookmark-card h2").first()).toHaveText("Zeta sort target");
    await page.locator("#sortSelect").selectOption("name");
    await expect(page.locator(".bookmark-card h2").first()).toHaveText("Alpha sort target");

    await page.locator("#clearSearch").click();
    const fallbackCard = page.locator(".bookmark-card").filter({ hasText: "A page I still want to keep" });
    await fallbackCard.getByRole("button", { name: /View details & note/ }).click();
    await page.locator("#labelInput").fill("read");
    await expect(page.locator("#labelSuggestions")).toContainText("Reading");
    await page.locator('#labelSuggestions [data-suggest-label="Reading"]').click();
    await expect(page.locator("#selectedLabels")).toContainText("Reading");
    await page.getByRole("button", { name: "Save changes" }).click();
  });

  test("guards and confirms permanent deletion of one bookmark", async ({ page }) => {
    await page.goto("/");
    const card = page.locator(".bookmark-card").filter({ hasText: "A page I still want to keep" });
    await card.getByRole("button", { name: /View details & note/ }).click();
    await page.locator("#deleteBookmarkButton").click();
    await expect(page.locator("#confirmTitle")).toContainText("A page I still want to keep");
    await expect(page.locator("#confirmCopy")).toContainText("cannot be undone");
    await page.locator("#cancelConfirm").click();
    await expect(page.locator("#bookmarkForm")).toBeVisible();
    await page.locator("#deleteBookmarkButton").click();
    await page.locator("#confirmDeleteButton").click();
    await expect(page.locator(".bookmark-card").filter({ hasText: "A page I still want to keep" })).toHaveCount(0);
    await expect(page.locator("#toast")).toContainText("Bookmark deleted");
  });
});
