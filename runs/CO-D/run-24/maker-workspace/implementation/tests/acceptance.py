#!/usr/bin/env python
"""Browser acceptance test for the bookmark manager (SCN-001..016).
Drives the real UI with Playwright against a running server (APP_URL)."""
import os, sys, tempfile
from playwright.sync_api import sync_playwright, expect

APP = os.environ.get("APP_URL", "http://127.0.0.1:4060")
FAILS = []

def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        FAILS.append(name)

SAMPLE = """<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
<DT><H3>Bookmarks bar</H3><DL><p>
  <DT><A HREF="https://alpha.example/a" ADD_DATE="1600000000" TAGS="reading">Alpha article</A>
  <DT><H3>Recipes</H3><DL><p>
     <DT><A HREF="https://beta.example/pasta" ADD_DATE="1610000000">Beta pasta</A>
  </DL><p>
  <DT><A HREF="https://gamma.example/g" ADD_DATE="1620000000" TAGS="reading,work">Gamma work</A>
</DL><p></DL><p>"""

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context()
        pg = ctx.new_page()

        # SCN-011: login
        pg.goto(APP + "/", wait_until="domcontentloaded")
        # not logged in -> redirected to /login
        pg.wait_for_url("**/login", timeout=8000)
        pg.wait_for_selector("[data-harness-ready='true']", timeout=8000)
        pg.click("#loginBtn")
        pg.wait_for_url(lambda u: u.rstrip("/").endswith(APP.rstrip("/")) or u.endswith("/"), timeout=8000)
        pg.wait_for_selector("[data-harness-ready='true']", timeout=10000)
        check("SCN-011 login reaches app", pg.query_selector("#saver") is not None)

        # SCN-015: import a bookmarks file (folders->tags, dates, dedupe)
        fp = os.path.join(tempfile.gettempdir(), "sample-bm.html")
        open(fp, "w").write(SAMPLE)
        pg.set_input_files("#importFile", fp)
        pg.wait_for_timeout(800)
        cards = pg.query_selector_all(".card")
        check("SCN-015 import added bookmarks", len(cards) >= 3)
        titles = " | ".join(e.inner_text() for e in pg.query_selector_all(".card .title"))
        check("SCN-015 import kept titles", "Beta pasta" in titles)
        tagtexts = [e.inner_text() for e in pg.query_selector_all(".card .tag")]
        check("SCN-015 folder became tag", "Recipes" in tagtexts)

        # SCN-001: save a new link with auto-filled details (real network)
        pg.fill("#url", "https://example.com")
        pg.click("#saveBtn")
        pg.wait_for_timeout(2500)
        titles = " | ".join(e.inner_text() for e in pg.query_selector_all(".card .title"))
        check("SCN-001 saved link auto-filled title", "Example" in titles)

        # SCN-014: preserved copy badge resolves (saved or failed, not stuck)
        got = False
        for _ in range(20):
            badges = [e.get_attribute("class") for e in pg.query_selector_all(".snap-badge")]
            if any("failed" not in (c or "") and "pending" not in (c or "") for c in badges):
                got = True; break
            pg.wait_for_timeout(700)
        check("SCN-014 a preserved copy was captured", got)

        # SCN-004 / SCN-008: search by exact tag
        pg.fill("#search", "#reading")
        pg.wait_for_timeout(300)
        shown = pg.query_selector_all(".card")
        check("SCN-004 #tag search filters", len(shown) == 2)
        pg.click("#searchClear")
        pg.wait_for_timeout(200)

        # SCN-007: sort A-Z
        pg.select_option("#sortSelect", "az")
        pg.wait_for_timeout(200)
        first = pg.query_selector(".card .title").inner_text()
        check("SCN-007 sort A-Z orders titles", first.startswith("Alpha"))
        pg.select_option("#sortSelect", "newest")

        # SCN-003: read later
        # mark the first card read later
        pg.click(".card .readlater-btn")
        pg.wait_for_timeout(200)
        pg.click("#tabs .tab[data-view='toread']")
        pg.wait_for_timeout(200)
        check("SCN-003 read-later tab shows marked", len(pg.query_selector_all(".card")) == 1)
        pg.click("#tabs .tab[data-view='all']")
        pg.wait_for_timeout(200)

        # SCN-005: archive then restore
        pg.click(".card .archive-btn")
        pg.wait_for_timeout(300)
        pg.click("#tabs .tab[data-view='archived']")
        pg.wait_for_timeout(200)
        check("SCN-005 archived tab shows item", len(pg.query_selector_all(".card")) >= 1)
        pg.click(".card .restore-btn")
        pg.wait_for_timeout(300)
        check("SCN-005 restore empties archived view", len(pg.query_selector_all(".card")) == 0)
        pg.click("#tabs .tab[data-view='all']")
        pg.wait_for_timeout(200)

        # SCN-013: save current search as a collection
        pg.fill("#search", "#reading")
        pg.wait_for_timeout(200)
        pg.click("#saveSearchBtn")
        pg.fill("#collName", "Reading")
        pg.click("#collSave")
        pg.wait_for_timeout(300)
        pg.click("#searchClear")
        pg.wait_for_timeout(200)
        chip = pg.query_selector(".coll-chip .open")
        check("SCN-013 collection chip created", chip is not None)
        chip.click()
        pg.wait_for_timeout(300)
        check("SCN-013 opening collection applies search", pg.input_value("#search") == "#reading")
        pg.click("#searchClear"); pg.wait_for_timeout(200)

        # SCN-012: bulk select-all-matching + add tag
        pg.fill("#search", "#reading"); pg.wait_for_timeout(200)
        pg.click("#selectBtn")
        pg.click("#selectAllBtn")
        pg.wait_for_timeout(150)
        pg.click("button[data-act='addTag']")
        pg.fill("#bulkTagInput", "bulktag")
        pg.click("#bulkTagApply")
        pg.wait_for_timeout(400)
        check("SCN-012 bulk tag applied", "bulktag" in [e.inner_text() for e in pg.query_selector_all(".card .tag")])
        pg.click("#bulkbar button[data-act='done']")
        pg.click("#searchClear"); pg.wait_for_timeout(200)

        # SCN-006: delete with confirmation (cancel then confirm)
        before = len(pg.query_selector_all(".card"))
        pg.click(".card .delete-btn")
        pg.wait_for_selector("#confirmBackdrop.open")
        pg.click("#cancelDelete")
        pg.wait_for_timeout(150)
        check("SCN-006 cancel keeps bookmark", len(pg.query_selector_all(".card")) == before)
        pg.click(".card .delete-btn")
        pg.wait_for_selector("#confirmBackdrop.open")
        pg.click("#confirmDelete")
        pg.wait_for_timeout(400)
        check("SCN-006 confirm deletes bookmark", len(pg.query_selector_all(".card")) == before - 1)

        # SCN-016: settings density compact hides preview; large text class
        pg.click("#settingsBtn")
        pg.click("#setDensity button[data-v='compact']")
        pg.wait_for_timeout(150)
        check("SCN-016 compact density applied", "density-compact" in pg.get_attribute("body", "class"))
        pg.click("#setFont button[data-v='large']")
        check("SCN-016 large text applied", "font-large" in pg.get_attribute("body", "class"))
        pg.select_option("#setSort", "az")
        pg.wait_for_timeout(150)
        pg.click("#settingsClose")

        # SCN-016/011: settings persist across reload (server-side per account)
        pg.reload()
        pg.wait_for_selector("[data-harness-ready='true']", timeout=8000)
        check("SCN-016 settings persisted after reload", "density-compact" in pg.get_attribute("body", "class"))

        b.close()

run()
if FAILS:
    print("\n%d CHECK(S) FAILED: %s" % (len(FAILS), ", ".join(FAILS)))
    sys.exit(1)
print("\nALL ACCEPTANCE CHECKS PASSED")
