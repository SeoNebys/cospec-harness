import os
from playwright.sync_api import sync_playwright, expect

BASE_URL = os.environ.get("TUCK_BASE_URL", "http://127.0.0.1:4000")


def run():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1360, "height": 1000})

        def metadata(route):
            address = route.request.url
            if "second" in address:
                payload = {"metadata": {"title": "Second Reading", "description": "Another useful reading page.", "iconUrl": "", "iconText": "S"}}
            else:
                payload = {"metadata": {"title": "Example Domain", "description": "A reserved domain used in examples and documentation.", "iconUrl": "", "iconText": "E"}}
            route.fulfill(status=200, content_type="application/json", json=payload)

        page.route("**/api/metadata*", metadata)
        page.goto(BASE_URL, wait_until="networkidle")
        expect(page.locator('[data-harness-ready="true"]')).to_have_count(1)
        expect(page.get_by_text("Nothing saved yet")).to_be_visible()
        expect(page.locator("#collection-tools")).to_be_hidden()

        page.locator("#url").fill("https://example.com/")
        expect(page.locator("#title")).to_have_value("Example Domain", timeout=3000)
        tag = page.locator("#tag-input")
        tag.fill("reading")
        tag.press("Enter")
        tag.fill("WORK")
        tag.press("Enter")
        page.get_by_role("button", name="Save bookmark").click()
        expect(page.locator(".bookmark-row")).to_have_count(1)
        expect(page.locator("#collection-count")).to_have_text("1 bookmark")
        expect(page.get_by_role("button", name="Show bookmarks tagged reading")).to_be_visible()

        page.locator("#url").fill("https://example.com/second")
        expect(page.locator("#title")).to_have_value("Second Reading", timeout=3000)
        tag.fill("rea")
        expect(page.get_by_role("option")).to_contain_text("reading")
        page.get_by_role("option").click()
        page.get_by_role("button", name="Save bookmark").click()
        expect(page.locator(".bookmark-row")).to_have_count(2)

        page.get_by_role("button", name="Show bookmarks tagged reading").first.click()
        expect(page.locator(".bookmark-row")).to_have_count(2)
        expect(page.locator(".filter-chip.active")).to_contain_text("reading")

        page.get_by_role("searchbox", name="Search titles, descriptions, and addresses").fill("SECOND")
        expect(page.locator(".bookmark-row")).to_have_count(1)
        expect(page.locator("#collection-count")).to_have_text("1 of 2 bookmarks")
        page.get_by_role("searchbox", name="Search titles, descriptions, and addresses").fill("nothing-here")
        expect(page.get_by_text("No matching bookmarks")).to_be_visible()
        expect(page.locator("#collection-count")).to_have_text("0 of 2 bookmarks")

        page.get_by_role("searchbox", name="Search titles, descriptions, and addresses").fill("")
        page.get_by_role("button", name="All tags").click()
        page.locator("#url").fill("https://example.com/#about")
        expect(page.locator("#title")).to_have_value("Example Domain", timeout=3000)
        page.get_by_role("button", name="Save bookmark").click()
        expect(page.locator(".bookmark-row")).to_have_count(2)
        expect(page.locator(".duplicate-focus")).to_have_count(1)
        expect(page.get_by_role("textbox", name="Edit bookmark title")).to_be_visible()

        page.get_by_label("Actions for Second Reading").click()
        page.get_by_role("button", name="Remove Second Reading").click()
        expect(page.locator(".bookmark-row")).to_have_count(1)
        expect(page.get_by_role("button", name="Undo")).to_be_visible()
        page.get_by_role("button", name="Undo").click()
        expect(page.locator(".bookmark-row")).to_have_count(2)

        before = page.locator("#collection-count").inner_text()
        page.locator("#url").fill("not a link")
        page.get_by_role("button", name="Save bookmark").click()
        expect(page.locator("#form-message")).to_contain_text("complete web address")
        assert page.locator("#collection-count").inner_text() == before

        browser.close()


if __name__ == "__main__":
    run()
    print("PASS: production browser flows")
