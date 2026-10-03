"""Browser acceptance exercise for the approved Keepmark scenarios."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from urllib.parse import unquote
from playwright.sync_api import sync_playwright, expect


class MetadataHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        title = unquote(self.path.strip("/")) or "Test Article"
        body = f'<html><head><title>{title}</title><meta name="description" content="Collected automatically"></head></html>'.encode()
        self.send_response(200)
        self.send_header("content-type", "text/html")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


metadata = ThreadingHTTPServer(("127.0.0.1", 0), MetadataHandler)
Thread(target=metadata.serve_forever, daemon=True).start()
article = f"http://127.0.0.1:{metadata.server_port}/Test%20Article"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1100})
    page.goto("http://127.0.0.1:4000/")
    page.locator('[data-harness-ready="true"]').wait_for()
    expect(page.locator(".empty-state")).to_contain_text("ready")

    # SCN-001, 002, 005, 009, 010, 015: rich save from an empty library.
    page.locator("#open-save").click()
    page.locator("#url").fill(article)
    page.locator("#tag-entry").fill("Research")
    page.locator("#tag-entry").press("Enter")
    page.locator("#add-note").click()
    page.locator("#note").fill("Read the section on promises")
    page.locator("#read-later").check()
    page.locator(".save-submit").click()
    expect(page.locator(".bookmark-card")).to_have_count(1, timeout=10000)
    expect(page.locator(".card-title")).to_have_text("Test Article")
    expect(page.locator(".tag-chip")).to_have_text("research")
    expect(page.locator(".card-note")).to_contain_text("promises")
    expect(page.locator(".status-chip.reading")).to_have_text("Read later")
    assert page.locator(".card-title").get_attribute("target") == "_blank"

    # SCN-008, 014: cosmetic URL differences resolve to the existing item.
    page.locator("#open-save").click()
    page.locator("#url").fill(article + "/#comments")
    page.locator(".save-submit").click()
    expect(page.locator("#toast")).to_contain_text("Already saved", timeout=5000)
    expect(page.locator(".bookmark-card")).to_have_count(1)

    # SCN-003, 004, 013: all-source search, tag filter, and no matches.
    page.locator("#search").fill("promises")
    expect(page.locator(".bookmark-card")).to_have_count(1)
    page.locator("#search").fill("underwater basket weaving")
    expect(page.locator(".empty-state")).to_contain_text("No bookmarks match")
    page.locator("#search").fill("")
    expect(page.locator(".bookmark-card")).to_have_count(1)
    page.locator('[data-tag="research"]').click()
    expect(page.locator(".bookmark-card")).to_have_count(1)
    page.locator('[data-tag=""]').click()

    # SCN-005, 016: complete the last Read later item without deleting it.
    page.locator('[data-section="read-later"]').click()
    expect(page.locator(".complete-check")).to_have_count(1)
    page.locator(".complete-check").check()
    expect(page.locator(".empty-state")).to_contain_text("Nothing waiting")
    page.locator('[data-section="active"]').click()
    expect(page.locator(".bookmark-card")).to_have_count(1)

    # SCN-006, 019: archive hides from active, archive search finds, restore clears Read later.
    page.locator(".more-button").click()
    page.locator('[data-action="archive"]').click()
    expect(page.locator(".empty-state")).to_contain_text("ready")
    page.locator('[data-section="archive"]').click()
    expect(page.locator(".bookmark-card")).to_have_count(1)
    page.locator("#search").fill("research")
    expect(page.locator(".bookmark-card")).to_have_count(1)
    page.locator("#search").fill("")
    page.locator(".more-button").click()
    page.locator('[data-action="restore"]').click()
    expect(page.locator(".empty-state")).to_contain_text("archive is empty")
    page.locator('[data-section="active"]').click()
    expect(page.locator(".status-chip.reading")).to_have_count(0)

    # SCN-011, 017: edit retained details and expand a long note.
    page.locator(".more-button").click()
    page.locator('[data-action="edit"]').click()
    page.locator("#edit-title").fill("Edited test article")
    page.locator("#edit-note").fill("A " + "very long reminder " * 15)
    page.locator("#save-edit").click()
    expect(page.locator(".card-title")).to_have_text("Edited test article")
    expect(page.locator(".show-note")).to_be_visible()
    page.locator(".show-note").click()
    expect(page.locator(".card-note")).to_have_class("card-note expanded")

    # SCN-007: cancellation is inert; explicit confirmation deletes.
    page.locator(".more-button").click()
    page.locator('[data-action="delete"]').click()
    expect(page.locator("#delete-dialog")).to_be_visible()
    page.locator('#delete-dialog button[value="cancel"]').click()
    expect(page.locator(".bookmark-card")).to_have_count(1)
    page.locator(".more-button").click()
    page.locator('[data-action="delete"]').click()
    page.locator("#confirm-delete").click()
    expect(page.locator(".empty-state")).to_be_visible()

    # SCN-018: initial batch and Show older span the complete library.
    for index in range(25):
        response = page.request.post("http://127.0.0.1:4000/api/bookmarks", data={"url": f"http://127.0.0.1:{metadata.server_port}/article-{index}", "tags": ["bulk"]})
        assert response.ok
    page.reload()
    page.locator('[data-harness-ready="true"]').wait_for()
    expect(page.locator(".bookmark-card")).to_have_count(20)
    expect(page.locator("#load-more")).to_be_visible()
    page.locator("#load-more").click()
    expect(page.locator(".bookmark-card")).to_have_count(25)

    browser.close()

metadata.shutdown()
print("Acceptance browser check passed: approved save, find, queue, archive, edit, delete, and large-library flows")
