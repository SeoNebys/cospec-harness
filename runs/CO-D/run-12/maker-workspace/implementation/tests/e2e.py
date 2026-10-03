"""Production browser acceptance checks for the approved Cycle 1 flows."""

import json
import os
import shutil
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
APP_PORT = 4010
FIXTURE_PORT = 4110


class PageFixture(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/article"):
            body = b'''<!doctype html><html><head>
            <title>The Art of Taking Better Walks</title>
            <meta name="description" content="Small observations that make an everyday walk more memorable.">
            </head><body>fixture</body></html>'''
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.send_header("Content-Type", "text/html")
            self.end_headers()

    def log_message(self, *_args):
        pass


def wait_until_ready(url, timeout=10):
    import urllib.request
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=0.5) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.1)
    raise RuntimeError("Trove server did not start")


def run():
    temp_dir = tempfile.mkdtemp(prefix="trove-e2e-")
    fixture = ThreadingHTTPServer(("127.0.0.1", FIXTURE_PORT), PageFixture)
    threading.Thread(target=fixture.serve_forever, daemon=True).start()
    env = dict(os.environ, PORT=str(APP_PORT), TROVE_DB_PATH=str(Path(temp_dir) / "e2e.db"))
    app = subprocess.Popen(["node", "implementation/server.js"], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    try:
        base = f"http://127.0.0.1:{APP_PORT}"
        wait_until_ready(base)
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            console_errors = []
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.goto(base, wait_until="networkidle")
            page.locator('[data-harness-ready="true"]').wait_for()

            # SCN-001/002/007/008: fetch, review, label, mark Read later, and save.
            article = f"http://127.0.0.1:{FIXTURE_PORT}/article?utm_source=test"
            page.get_by_label("Web address").fill(article)
            page.get_by_role("button", name="Get details").click()
            page.locator("#reviewDialog[open]").wait_for()
            assert page.locator("#titleInput").input_value() == "The Art of Taking Better Walks"
            page.locator("#titleInput").fill("My walking guide")
            page.locator("#descriptionInput").fill("My own description for this walk.")
            page.get_by_label("Add labels").fill("Cooking")
            page.get_by_role("button", name='Create “Cooking” New label').click()
            page.locator("#readLaterInput").check(force=True)
            page.get_by_role("button", name="Save bookmark").click()
            page.locator(".bookmark-card").wait_for()
            assert page.locator(".bookmark-card h3").inner_text() == "My walking guide"
            assert page.locator(".bookmark-card .description").inner_text() == "My own description for this walk."
            assert page.locator(".card-label", has_text="Cooking").is_visible()
            assert page.locator("#laterCount").inner_text() == "1"
            assert page.locator("#gridCaption").inner_text() == "RECENTLY SAVED"

            # SCN-005: add a formatted searchable note directly on the card.
            page.get_by_role("button", name="Add note").click()
            note_box = page.get_by_role("textbox", name="Personal note")
            note_box.fill("Make time for this on Sunday")
            note_box.press("Control+A")
            page.get_by_role("button", name="Bold").click()
            page.get_by_role("button", name="Save note").click()
            page.locator(".note-content b, .note-content strong").wait_for()
            assert "Sunday" in page.locator(".note-content").inner_text()

            # SCN-003/014: a safe address variation finds the existing edited bookmark.
            page.get_by_label("Web address").fill(f"http://127.0.0.1:{FIXTURE_PORT}/article/?ref=email")
            page.get_by_role("button", name="Get details").click()
            page.get_by_text("You already saved this link — here it is.").wait_for()
            assert page.locator(".bookmark-card").count() == 1
            assert page.locator(".bookmark-card h3").inner_text() == "My walking guide"

            # SCN-004/011: live search includes notes and has a clear no-match state.
            search = page.get_by_label("Search saved links")
            search.fill("Sunday")
            page.wait_for_timeout(160)
            assert page.locator(".bookmark-card").count() == 1
            search.fill("volcano")
            page.wait_for_timeout(160)
            assert page.get_by_text("No saved links match that search.").is_visible()
            assert page.locator("#allCount").inner_text() == "1"
            search.fill("")
            page.wait_for_timeout(160)

            # SCN-009/010: invalid input and unavailable metadata both remain recoverable.
            page.get_by_label("Web address").fill("not really an address")
            page.get_by_role("button", name="Get details").click()
            page.wait_for_function("document.querySelector('#urlMessage').textContent.includes('complete web address')")
            assert "complete web address" in page.locator("#urlMessage").inner_text()
            missing = f"http://127.0.0.1:{FIXTURE_PORT}/missing"
            page.get_by_label("Web address").fill(missing)
            page.get_by_role("button", name="Get details").click()
            page.locator("#reviewDialog[open]").wait_for()
            assert page.locator("#fetchWarning").is_visible()
            page.locator("#titleInput").fill("A page I can still keep")
            page.get_by_label("Add labels").fill(" cooking ")
            suggestion = page.locator(".suggestion-row", has_text="Cooking").first
            assert "Used on 1 link" in suggestion.inner_text()
            suggestion.click()
            page.get_by_role("button", name="Save bookmark").click()
            page.wait_for_timeout(180)
            assert page.locator("#allCount").inner_text() == "2"

            # SCN-006/015: the same label is reused, counted, and filters both bookmarks.
            cooking_filter = page.locator(".filter-chip", has_text="Cooking")
            assert "2" in cooking_filter.inner_text()
            cooking_filter.click()
            page.wait_for_timeout(150)
            assert page.locator(".bookmark-card").count() == 2

            # SCN-008/012: completion empties Read later without deleting the bookmark.
            page.locator('[data-view="later"]').click()
            page.wait_for_timeout(150)
            assert page.locator(".bookmark-card").count() == 1
            page.get_by_role("button", name="Mark done").click()
            page.get_by_text("You’re all caught up.").wait_for()
            assert page.locator("#laterCount").inner_text() == "0"
            page.locator('[data-view="all"]').click()
            page.wait_for_timeout(150)
            assert page.locator(".bookmark-card").count() == 2

            # SCN-007: existing labels are selected and removable when editing later.
            page.locator(".bookmark-card", has_text="A page I can still keep").get_by_role("button", name="Edit bookmark").click()
            page.locator("#reviewDialog[open]").wait_for()
            assert page.locator(".selected-label", has_text="Cooking").is_visible()
            page.get_by_role("button", name="Close review").click()

            # SCN-013: long formatted notes begin folded and expand in place.
            data = page.request.get(f"{base}/api/bookmarks").json()
            first = next(item for item in data["bookmarks"] if item["title"] == "My walking guide")
            long_note = "<p><strong>Remember this.</strong></p><ul>" + "".join(f"<li>Step {i} with plenty of detail</li>" for i in range(1, 10)) + "</ul><p><a href=\"https://example.com\">Reference</a></p>"
            many_labels = ["Cooking", "Ideas", "Long-form reading", "Reference material", "Weekend project", "Great outdoors", "Mindfulness", "Personal growth", "Come back soon"]
            response = page.request.patch(f"{base}/api/bookmarks/{first['id']}", data={"noteHtml": long_note, "labels": many_labels})
            assert response.ok
            page.reload(wait_until="networkidle")
            page.locator('[data-harness-ready="true"]').wait_for()
            walking = page.locator(".bookmark-card", has_text="My walking guide")
            show_full = walking.get_by_role("button", name="Show full note")
            assert show_full.is_visible()
            show_full.click()
            assert "folded" not in (walking.locator(".note-content").get_attribute("class") or "")
            wraps = walking.locator(".card-labels").evaluate("node => node.scrollHeight > node.firstElementChild.getBoundingClientRect().height + 3")
            assert wraps

            # SCN-007: labels can also be removed and saved later.
            page.locator(".bookmark-card", has_text="A page I can still keep").get_by_role("button", name="Edit bookmark").click()
            page.get_by_role("button", name="Remove Cooking").click()
            page.get_by_role("button", name="Save changes").click()
            page.wait_for_timeout(180)
            saved_missing = page.locator(".bookmark-card", has_text="A page I can still keep")
            assert saved_missing.locator(".card-label", has_text="Cooking").count() == 0

            assert console_errors == [], console_errors
            page.screenshot(path=str(ROOT / "implementation" / "verification.png"), full_page=True)
            browser.close()
    finally:
        app.terminate()
        try:
            app.wait(timeout=4)
        except subprocess.TimeoutExpired:
            app.kill()
        fixture.shutdown()
        fixture.server_close()
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    run()
    print("production browser scenarios passed")
