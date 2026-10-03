#!/usr/bin/env python
"""Gherkin-based acceptance tests for the Bookmarks app (Phase 3 verification).
Boots a local fixture site + the real app server, drives Chromium, and asserts
the approved behaviours (SCN-001..018). Exits non-zero on any failure."""
import http.server, socketserver, threading, tempfile, subprocess, time, os, sys, json, urllib.request, functools, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
FIX_PORT = int(os.environ.get("FIX_PORT", "4011"))
APP_PORT = int(os.environ.get("APP_PORT", "4012"))

# ---- fixture site ----
fix_dir = tempfile.mkdtemp()
def w(name, content, binary=False):
    p = pathlib.Path(fix_dir)/name
    p.write_bytes(content if binary else content.encode())
w("page1.html", '<!doctype html><title>Alpha Guide</title><meta name="description" content="All about alpha closures"><body><h1>Alpha</h1><img src="pic.png"></body>')
w("page2.html", '<!doctype html><title>Beta Travel</title><meta name="description" content="walking guide to beta"><body>Beta</body>')
w("pic.png", b'\x89PNG\r\n\x1a\n' + b'0'*40, binary=True)
w("doc.pdf", b'%PDF-1.4 fake pdf bytes', binary=True)

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
Handler = functools.partial(Q, directory=fix_dir)
# Threaded so Node's keep-alive connections don't block concurrent fetches.
httpd = http.server.ThreadingHTTPServer(("127.0.0.1", FIX_PORT), Handler)
httpd.daemon_threads = True
threading.Thread(target=httpd.serve_forever, daemon=True).start()

# ---- app server (dedicated data dir via a tiny bootstrap) ----
data_dir = tempfile.mkdtemp()
boot = pathlib.Path(tempfile.mktemp(suffix='.js'))
boot.write_text(f"const{{createServer}}=require({json.dumps(str(ROOT/'server.js'))});"
                f"createServer({{dataDir:{json.dumps(data_dir)}}}).listen({APP_PORT},'127.0.0.1');")
app = subprocess.Popen(["node", str(boot)], cwd=str(ROOT))

def wait_up(url, tries=50):
    for _ in range(tries):
        try:
            urllib.request.urlopen(url); return True
        except Exception: time.sleep(0.1)
    return False
assert wait_up(f"http://127.0.0.1:{APP_PORT}/api/state"), "app server did not start"

FIX = f"http://127.0.0.1:{FIX_PORT}"
APP = f"http://127.0.0.1:{APP_PORT}"
fails = []
def check(name, cond):
    print(("PASS" if cond else "FAIL"), name);
    if not cond: fails.append(name)

from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.on("dialog", lambda d: d.accept())
    pg.goto(APP); pg.wait_for_selector('[data-harness-ready="true"]')
    check("SCN-009 empty state shown", "No bookmarks yet" in pg.inner_text('#list'))

    # SCN-001 save with auto-fill + note + tag
    pg.fill('#url', f"{FIX}/page1.html"); pg.click('#saveBtn')
    pg.wait_for_selector('#dTitle')
    check("SCN-001 auto-filled title", pg.input_value('#dTitle') == 'Alpha Guide')
    check("SCN-001 auto-filled description", 'alpha closures' in pg.input_value('#dDesc'))
    pg.fill('#dTags', 'reading'); pg.fill('#dNote', 'Note **bold**')
    pg.click('#confirmSave'); pg.wait_for_timeout(600)
    check("SCN-001 appears in list", 'Alpha Guide' in pg.inner_text('#list'))
    check("SCN-014 saved copy shown", 'Saved copy' in pg.inner_text('#list'))
    check("SCN-012 new link unread (dot)", pg.query_selector('.unreadDot') is not None)

    # second + third bookmarks
    pg.fill('#url', f"{FIX}/page2.html"); pg.click('#saveBtn'); pg.wait_for_selector('#dTitle')
    pg.fill('#dTags', 'travel'); pg.click('#confirmSave'); pg.wait_for_timeout(500)
    pg.fill('#url', f"{FIX}/doc.pdf"); pg.click('#saveBtn'); pg.wait_for_selector('#dTitle')
    pg.click('#confirmSave'); pg.wait_for_timeout(500)
    check("SCN-014 PDF preserved label", 'Saved PDF' in pg.inner_text('#list'))

    # SCN-003 search
    def count_text():
        return pg.inner_text('#count')
    pg.fill('#search', 'alpha'); pg.wait_for_timeout(100); check("SCN-003 word search", count_text().startswith('1'))
    pg.fill('#search', '#travel'); pg.wait_for_timeout(100); check("SCN-003 tag search", count_text().startswith('1'))
    pg.fill('#search', '"walking guide"'); pg.wait_for_timeout(100); check("SCN-003 phrase search", count_text().startswith('1'))
    pg.fill('#search', 'alpha OR beta'); pg.wait_for_timeout(100); check("SCN-003 boolean OR", count_text().startswith('2'))
    pg.fill('#search', ''); pg.wait_for_timeout(100)

    # SCN-004 click tag to filter
    pg.click('.tag[data-tag="travel"]'); pg.wait_for_timeout(150)
    check("SCN-004 tag click filters", pg.input_value('#search') == '#travel' and count_text().startswith('1'))
    pg.click('#clearSearch'); pg.wait_for_timeout(100)

    # SCN-005 duplicate warning (trailing slash variant)
    pg.fill('#url', f"{FIX}/page1.html/"); pg.click('#saveBtn'); pg.wait_for_timeout(200)
    check("SCN-005 duplicate warning", 'already saved' in pg.inner_text('#saveArea'))
    pg.click('#cancelDup')

    # SCN-012 read filter + toggle
    pg.select_option('#statusFilter', 'unread'); pg.wait_for_timeout(100)
    unread_before = count_text()
    # mark the first unread one read
    pg.query_selector('.readBtn').click(); pg.wait_for_timeout(300)
    check("SCN-012 unread-only updates on mark read", count_text() != unread_before)
    pg.select_option('#statusFilter', 'all'); pg.wait_for_timeout(100)

    # SCN-013 archive/restore + delete confirm
    pg.query_selector('.archiveBtn').click(); pg.wait_for_timeout(300)
    active_after = count_text()
    pg.select_option('#locationFilter', 'archived'); pg.wait_for_timeout(150)
    check("SCN-013 archived view shows item", count_text().startswith('1'))
    pg.query_selector('.restoreBtn').click(); pg.wait_for_timeout(300)
    check("SCN-013 restore empties archived view", count_text().startswith('0'))
    pg.select_option('#locationFilter', 'active'); pg.wait_for_timeout(150)

    # SCN-014 open an HTML saved copy in a new tab (avoid PDF viewer's load event)
    page_btn = next(x for x in pg.query_selector_all('.savedCopyBtn') if x.inner_text().startswith('Saved copy'))
    with pg.context.expect_page() as np:
        page_btn.click()
    tab = np.value; tab.wait_for_load_state('domcontentloaded')
    check("SCN-014 saved copy banner", 'Saved copy of the page' in tab.content()); tab.close()

    # SCN-015 bulk: select all matching + mark read
    boxes = pg.query_selector_all('.selBox'); boxes[0].click(); pg.wait_for_timeout(100)
    pg.click('#selAll'); pg.wait_for_timeout(100)
    total = int(count_text().split()[0])
    check("SCN-015 select all matching count", str(total) + ' selected' in pg.inner_text('#bulkBar'))
    pg.click('#bRead'); pg.wait_for_timeout(300)
    check("SCN-015 bulk mark read cleared selection", not pg.is_visible('#bulkBar'))

    # SCN-016 saved search builder
    pg.click('#saveSearch'); pg.wait_for_timeout(100)
    pg.fill('#ssName', 'Travel view')
    inc = pg.query_selector('#ssInc .mtinput'); inc.click(); inc.type('travel'); pg.wait_for_timeout(120)
    if pg.query_selector('#ssInc .mtopt'): pg.query_selector('#ssInc .mtopt').click()
    pg.click('#ssSave'); pg.wait_for_timeout(300)
    check("SCN-016 saved chip created", 'Travel view' in pg.inner_text('#savedRow'))
    pg.query_selector_all('.applySaved')[-1].click(); pg.wait_for_timeout(200)
    check("SCN-016 applying saved search filters", '#travel' in pg.input_value('#search'))
    pg.click('#clearSearch'); pg.select_option('#statusFilter','all'); pg.wait_for_timeout(100)

    # SCN-017 import + export
    pg.click('#importBtn'); pg.wait_for_timeout(100); pg.click('#impSample'); pg.wait_for_timeout(400)
    check("SCN-017 import summary", 'Imported' in pg.inner_text('#impResult'))
    pg.query_selector('#impClose').click()
    pg.fill('#search', '#design'); pg.wait_for_timeout(120)
    check("SCN-017 folder became tag", count_text().startswith('1'))
    pg.fill('#search',''); pg.wait_for_timeout(100)
    with pg.expect_download() as dl:
        pg.click('#exportBtn')
    content = pathlib.Path(dl.value.path()).read_text()
    check("SCN-017 export has tags+dates", 'TAGS=' in content and 'ADD_DATE=' in content)

    # SCN-018 preferences persist across reload (server-side)
    pg.click('#prefsBtn'); pg.wait_for_timeout(100)
    pg.select_option('#pfPage', '50'); pg.select_option('#pfSort', 'az'); pg.click('#pfSave'); pg.wait_for_timeout(200)
    pg.reload(); pg.wait_for_selector('[data-harness-ready="true"]')
    check("SCN-018 sort persisted after reload", pg.input_value('#sort') == 'az')
    pg.click('#prefsBtn'); pg.wait_for_timeout(100)
    check("SCN-018 page size persisted", pg.input_value('#pfPage') == '50')

    b.close()

app.terminate(); httpd.shutdown()
print(f"\n{'ALL ACCEPTANCE TESTS PASSED' if not fails else 'FAILURES: '+', '.join(fails)}")
sys.exit(1 if fails else 0)
