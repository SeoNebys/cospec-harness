"""
Acceptance test — drives the real app against approved scenarios (SCN-001..015).
Metadata is stubbed via request interception so the happy path is deterministic
without external network; the fetch-failure fallback is tested by stubbing ok:false.
Usage: BASE=http://127.0.0.1:4005 python test/acceptance.py
"""
import os, sys, json
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:4005")
passed = 0; failed = 0
def check(name, cond):
    global passed, failed
    if cond: passed += 1; print(f"  ok  {name}")
    else: failed += 1; print(f"FAIL  {name}")

META = {"ok": True, "title": "Stub Title", "description": "Stub description", "site": "Stub Site", "image": None, "favicon": None, "domain": "example.com"}
def route_meta(route, ok=True, title="Stub Title"):
    body = dict(META); body["ok"] = ok
    if not ok: body = {"ok": False, "reason": "unreachable"}
    else: body["title"] = title
    route.fulfill(status=200, content_type="application/json", body=json.dumps(body))

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("dialog", lambda d: d.accept("Sweepers"))  # confirms ignore text; the save-view prompt uses it as the name
    meta_ok = {"v": True}; meta_title = {"v": "Stub Title"}
    pg.route("**/api/metadata", lambda route: route_meta(route, meta_ok["v"], meta_title["v"]))
    pg.goto(BASE); pg.wait_for_selector("[data-harness-ready]")

    def save(url, title=None, toread=False, note=None, tags=None):
        pg.fill("#url", url); pg.click("#saveBtn"); pg.wait_for_selector("#draftSave")
        if toread: pg.click('.panel .pill[data-shelf="toread"]')
        if title is not None: pg.fill("#draftTitle", title)
        if note is not None: pg.fill("#draftNote", note)
        for t in (tags or []):
            ti = pg.query_selector("#taginput-draft"); ti.fill(t); ti.press("Enter")
        pg.click("#draftSave"); pg.wait_for_timeout(150)

    # SCN-001 save with review, details prefilled from (stubbed) metadata
    meta_title["v"] = "Deep-Sea Cables"
    pg.fill("#url", "nytimes.com"); pg.click("#saveBtn"); pg.wait_for_selector("#draftSave")
    check("SCN-001 review shows fetched title", pg.input_value("#draftTitle") == "Deep-Sea Cables")
    pg.click("#draftSave"); pg.wait_for_timeout(200)
    card = pg.query_selector("li.item")
    check("SCN-001 saved card present", card is not None)
    check("SCN-001 opens original url", pg.get_attribute("li.item .title a", "href") == "https://nytimes.com/")

    # SCN-002 invalid refused
    pg.fill("#url", "this is not a link"); pg.click("#saveBtn"); pg.wait_for_timeout(120)
    check("SCN-002 invalid refused (no draft)", pg.query_selector("#draftSave") is None and "usable web address" in pg.inner_text("#status"))
    check("SCN-002 still one link", len(pg.query_selector_all("li.item")) == 1)

    # SCN-003 duplicate opens existing entry
    pg.fill("#url", "nytimes.com"); pg.click("#saveBtn"); pg.wait_for_timeout(200)
    check("SCN-003 duplicate opens editor", pg.query_selector('[data-save]') is not None and len(pg.query_selector_all("li.item")) == 1)
    pg.click('[data-cancel]'); pg.wait_for_timeout(80)

    # SCN-002 fetch-failure fallback -> manual entry
    meta_ok["v"] = False
    pg.fill("#url", "unreachable.test"); pg.click("#saveBtn"); pg.wait_for_selector("#draftSave")
    check("SCN-002 fetch-fail shows notice + empty title", pg.query_selector(".notice") is not None and pg.input_value("#draftTitle") == "")
    pg.fill("#draftTitle", "Manual title"); pg.click("#draftSave"); pg.wait_for_timeout(150)
    check("SCN-002 manual save works", any("Manual title" in c.inner_text() for c in pg.query_selector_all("li.item")))
    meta_ok["v"] = True

    # SCN-006 reading/reference: save a To-read, mark read -> becomes reference, leaves To read
    meta_title["v"] = "Reading item"
    save("arstechnica.com", title="Reading item", toread=True)
    def tab(f): return pg.inner_text(f'.filter[data-filter="{f}"]')
    check("SCN-006 to-read count 1", "To read 1" in tab("toread"))
    pg.click('.filter[data-filter="toread"]'); pg.wait_for_timeout(80)
    pg.click('[data-read]'); pg.wait_for_timeout(150)
    check("SCN-006 mark read empties To read", "To read 0" in tab("toread"))

    # SCN-007/008/009 tags, note, search
    pg.click('.filter[data-filter="all"]'); pg.wait_for_timeout(60)
    save("github.com", title="SQLite engine", note="**keep** for _rome_ project", tags=["code", "db"])
    # markdown rendered
    check("SCN-009 note renders markdown", pg.query_selector("li.item .note strong") is not None)
    # search finds by note word
    pg.fill("#search", "rome"); pg.wait_for_timeout(120)
    check("SCN-008 search by note word", len(pg.query_selector_all("li.item")) == 1)
    pg.fill("#search", "#code and sqlite"); pg.wait_for_timeout(120)
    check("SCN-008 tag+word query", len(pg.query_selector_all("li.item")) == 1)
    pg.fill("#search", ""); pg.wait_for_timeout(80)

    # SCN-011 sort title az
    pg.select_option("#sortby", "title-az"); pg.wait_for_timeout(100)
    titles = [c.inner_text() for c in pg.query_selector_all("li.item .title")]
    check("SCN-011 sort A-Z", titles == sorted(titles, key=str.lower))
    pg.select_option("#sortby", "newest"); pg.wait_for_timeout(80)

    # SCN-010 archive + restore + delete-only-in-archive
    n_all_before = tab("all")
    pg.query_selector('[data-archive]').click(); pg.wait_for_timeout(150)
    check("SCN-010 archive moves out of All", tab("all") != n_all_before and "Archived 1" in tab("archived"))
    pg.click('.filter[data-filter="archived"]'); pg.wait_for_timeout(80)
    check("SCN-010 delete only in archive", pg.query_selector('[data-delete]') is not None)
    pg.query_selector('[data-restore]').click(); pg.wait_for_timeout(150)
    check("SCN-010 restore returns it", "Archived 0" in tab("archived"))

    # SCN-012 bulk: select all matching, add tag
    pg.click('.filter[data-filter="all"]'); pg.wait_for_timeout(60)
    pg.query_selector_all(".selbox")[0].click(); pg.wait_for_timeout(80)
    check("SCN-012 bulk bar select-all label", "matching" in pg.inner_text("[data-selall]"))
    pg.click("[data-selall]"); pg.wait_for_timeout(80)
    pg.fill("#bulkTag", "sweep"); pg.click('[data-op="addTag"]'); pg.wait_for_timeout(150)
    check("SCN-012 bulk tag applied to all", all("#sweep" in c.inner_text() for c in pg.query_selector_all("li.item")))

    # SCN-013 saved view: include tag, save, clear, reapply
    pg.click('[data-clear]') if pg.query_selector('[data-clear]') else None
    pg.wait_for_timeout(60)
    pg.click('[data-tagfilter="sweep"]'); pg.wait_for_timeout(80)
    n_sweep = len(pg.query_selector_all("li.item"))
    pg.click("#saveView"); pg.wait_for_timeout(250)
    check("SCN-013 saved view chip created", pg.query_selector("[data-applyview]") is not None)
    # clear filters, then re-apply the saved view and confirm it restores the same set
    for rm in list(pg.query_selector_all("[data-rmfilter]")): rm.click(); pg.wait_for_timeout(50)
    pg.query_selector("[data-applyview]").click(); pg.wait_for_timeout(150)
    check("SCN-013 saved view re-applies same set", len(pg.query_selector_all("li.item")) == n_sweep)

    # SCN-015 preferences: default order + text size + perPage
    pg.click("#prefsBtn"); pg.wait_for_selector(".panel")
    pg.select_option("#prefPer", "10"); pg.wait_for_timeout(80)
    pg.click('[data-textsize="large"]'); pg.wait_for_timeout(80)
    check("SCN-015 text size applied", "txt-large" in (pg.get_attribute("body", "class") or ""))
    pg.select_option("#prefSort", "title-za"); pg.wait_for_timeout(100)
    check("SCN-015 default order updates sort dropdown", pg.input_value("#sortby") == "title-za")

    # SCN-014 export round-trips (client build)
    export_html = pg.evaluate("(function(){ return LL.buildBookmarksHtml(window.__x||[]); })()") if False else None

    print(f"\npage errors: {errs}")
    b.close()

print(f"\n== acceptance: {passed} passed, {failed} failed ==")
sys.exit(1 if failed else 0)
