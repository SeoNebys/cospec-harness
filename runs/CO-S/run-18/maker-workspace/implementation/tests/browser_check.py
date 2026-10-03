"""Run with /opt/browser-tools/bin/python while the app is listening on port 4000."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.goto("http://127.0.0.1:4000/")
    page.locator('[data-harness-ready="true"]').wait_for()
    assert page.locator("#section-title").inner_text() == "All bookmarks"
    assert page.locator(".empty-state").is_visible()
    page.locator("#open-save").click()
    page.locator("#url").fill("not a link")
    page.locator(".save-submit").click()
    page.locator("#url-error", has_text="complete web address").wait_for()
    assert "complete web address" in page.locator("#url-error").inner_text()
    assert page.locator("#active-count").inner_text() == "0"
    browser.close()
print("Browser check passed: ready state, empty library, and invalid-address flow")
