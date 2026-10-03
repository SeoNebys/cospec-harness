#!/usr/bin/env python
"""Gherkin-based acceptance tests for Bookmark Keeper (Phase 3).

Drives the real application through a browser against a live server, and uses a
small local "target site" so title lookup (SCN-001) and safety-net snapshots
(SCN-005) are exercised through the real fetch path without needing the internet.
"""
import http.server, socketserver, threading, subprocess, tempfile, time, os, sys, socket, urllib.request
from playwright.sync_api import sync_playwright, expect

APP_PORT = 4100
SITE_PORT = 4102
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TARGET_HTML = b"""<!DOCTYPE html><html><head><title>Great Article</title></head>
<body><h1>Great Article</h1><p>Body paragraph one.</p><p>Body paragraph two.</p></body></html>"""


class ReusableServer(socketserver.TCPServer):
    allow_reuse_address = True


class SiteHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(TARGET_HTML)
    def log_message(self, *a):
        pass


def wait_port(port, timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with socket.create_connection(("127.0.0.1", port), 0.3):
                return True
        except OSError:
            time.sleep(0.15)
    raise RuntimeError(f"port {port} did not open")


def main():
    tmp = tempfile.mkdtemp(prefix="bm-accept-")
    site = ReusableServer(("127.0.0.1", SITE_PORT), SiteHandler)
    threading.Thread(target=site.serve_forever, daemon=True).start()

    env = dict(os.environ, PORT=str(APP_PORT), DATA_DIR=tmp)
    app = subprocess.Popen(["node", "server.js"], cwd=ROOT, env=env)
    target = f"http://127.0.0.1:{SITE_PORT}/article"
    passed = []
    try:
        wait_port(APP_PORT)
        base = f"http://127.0.0.1:{APP_PORT}/"
        with sync_playwright() as p:
            b = p.chromium.launch()
            page = b.new_page()
            page.goto(base)
            expect(page.locator("body")).to_have_attribute("data-harness-ready", "true")

            def save(url, tags=(), note="", toread=True, keepcopy=False, expect_title=None):
                page.fill("#url", url)
                page.eval_on_selector("#url", "e=>e.blur()")
                if expect_title is not None:
                    expect(page.locator("#title")).to_have_value(expect_title, timeout=6000)
                for t in tags:
                    page.fill("#tagInput", t); page.keyboard.press("Enter")
                if note:
                    page.fill("#note", note)
                if not toread:
                    page.uncheck("#toread")
                if keepcopy:
                    page.check("#keepcopy")
                page.click("#saveBtn")

            # SCN-009: empty state
            assert "No links saved yet" in page.inner_text("#list")
            passed.append("SCN-009 empty state")

            # SCN-008: empty + invalid address
            page.click("#saveBtn")
            expect(page.locator("#formMsg")).to_contain_text("Please enter a link address")
            page.fill("#url", "not a url"); page.click("#saveBtn")
            expect(page.locator("#formMsg")).to_contain_text("valid web address")
            passed.append("SCN-008 empty/invalid address")

            # SCN-001: save with auto-filled title (real lookup of local target)
            save(target, tags=["reading", "tech"], note="worth revisiting", expect_title="Great Article")
            expect(page.locator("#list .item")).to_have_count(1)
            assert "Great Article" in page.inner_text("#list")
            assert "1 saved link" in page.inner_text("#count")
            passed.append("SCN-001 save + auto title")

            # SCN-002: tags visible + filter
            assert "#reading" in page.inner_text("#list")
            save("https://example.com/pasta", tags=["recipes"], expect_title=None)
            page.click("#filterBar >> text=#recipes")
            expect(page.locator("#count")).to_contain_text("tagged #recipes")
            page.click("#filterBar >> text=clear filter")
            passed.append("SCN-002 tags + filter")

            # SCN-003: search across fields
            page.fill("#search", "revisiting")   # matches the note only
            expect(page.locator("#count")).to_contain_text("1 saved link")
            page.fill("#search", "zzzzz")
            expect(page.locator("#list")).to_contain_text("No links match")
            page.fill("#search", "")
            passed.append("SCN-003 search")

            # SCN-004: to-read tracking
            save("https://example.com/already-read", toread=False, expect_title=None)
            page.click("#readTabs >> text=To read")
            # 2 of the 3 are to-read (target + pasta); already-read excluded
            expect(page.locator("#count")).to_contain_text("2 saved links")
            # mark one read
            page.locator("#list .item").first.locator("text=Mark as read").click()
            expect(page.locator("#count")).to_contain_text("1 saved link")
            page.click("#readTabs >> text=All")
            passed.append("SCN-004 to-read tracking")

            # SCN-005: keep a copy + view it (real snapshot of local target)
            save(f"http://127.0.0.1:{SITE_PORT}/keep", keepcopy=True, expect_title="Great Article")
            item = page.locator('[data-item]', has_text="Great Article").filter(has_text="Copy kept").first
            item.locator("text=View saved copy").click()
            snap = page.locator(".snap")
            expect(snap).to_be_visible()
            assert "Body paragraph one" in snap.inner_text()
            assert "captured on" in snap.inner_text()
            page.click("#closeSnap") if page.query_selector("#closeSnap") else page.click(".snap .bar button")
            passed.append("SCN-005 keep + view copy")

            # SCN-007: duplicate prevention + go to it
            before = page.locator("#list .item").count()
            page.fill("#url", "https://example.com/pasta"); page.click("#saveBtn")
            expect(page.locator("#formMsg")).to_contain_text("already saved this link")
            assert page.locator("#list .item").count() == before
            page.click("#formMsg >> text=Go to it")
            passed.append("SCN-007 duplicate prevention")

            # SCN-006: edit including address, with validation
            pasta_id = page.locator('[data-item]', has_text="pasta").first.get_attribute("data-item")
            editing = page.locator(f'[data-item="{pasta_id}"]')
            editing.locator("text=Edit").click()
            editing.locator("input[type=url]").fill("bad")
            editing.locator("text=Save changes").click()
            expect(editing).to_contain_text("valid web address")
            editing.locator("input[type=url]").fill("https://example.com/pasta-moved")
            editing.locator("input[type=text]").first.fill("Pasta Recipe")
            editing.locator("text=Save changes").click()
            expect(page.locator('[data-item]', has_text="Pasta Recipe")).to_have_count(1)
            passed.append("SCN-006 edit + address validation")

            # SCN-010: remove with confirmation
            count_before = page.locator("#list .item").count()
            victim = page.locator('[data-item]', has_text="Pasta Recipe").first
            victim.locator("text=Remove").click()
            victim.locator("text=Keep").click()
            assert page.locator("#list .item").count() == count_before
            victim = page.locator('[data-item]', has_text="Pasta Recipe").first
            victim.locator("text=Remove").click()
            victim.locator(".inline-confirm >> text=Remove").click()
            expect(page.locator('[data-item]', has_text="Pasta Recipe")).to_have_count(0)
            passed.append("SCN-010 remove with confirm")

            # SCN-011: persistence across a fresh visit (reload -> refetch from disk)
            names_before = page.inner_text("#list")
            page.reload()
            expect(page.locator("body")).to_have_attribute("data-harness-ready", "true")
            assert "Great Article" in page.inner_text("#list")
            passed.append("SCN-011 persistence")

            b.close()
    finally:
        app.terminate()
        try: app.wait(timeout=5)
        except Exception: app.kill()
        site.shutdown()

    print("\nPASSED SCENARIOS:")
    for s in passed:
        print("  ✔", s)
    print(f"\n{len(passed)} scenario groups passed.")


if __name__ == "__main__":
    main()
