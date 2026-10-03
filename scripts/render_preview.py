#!/usr/bin/env python3
"""Render a static HTML file to a PNG so the director can 'see' a prototype.

Used by the broker's presentation curation. Requires playwright + chromium:
  pip install playwright && playwright install chromium

Running apps are captured over HTTP with readiness and resource checks.
Static prototype rendering returns False if playwright is unavailable.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import urlsplit


def render_app(url: str, png_path: Path, ready_selector: str | None = None) -> dict:
    """Keep reviewable app failures distinct from failures of the capture tools."""
    result = {"url": url, "ok": False, "capture_ok": False,
              "failure_kind": "environment_error", "issues": [],
              "page_errors": [], "failed_resources": []}
    try:
        from playwright.sync_api import sync_playwright, Error as BrowserError
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                page = browser.new_page(viewport={"width": 1280, "height": 900})
                page.on("pageerror", lambda error: result["page_errors"].append(str(error)))
                origin = urlsplit(url).netloc

                def relevant(request):
                    return (urlsplit(request.url).netloc == origin and
                            request.resource_type in {"script", "stylesheet", "fetch", "xhr"})

                page.on("requestfailed", lambda request: result["failed_resources"].append(
                    {"url": request.url, "error": request.failure}) if relevant(request) else None)
                page.on("response", lambda response: result["failed_resources"].append(
                    {"url": response.url, "status": response.status})
                    if relevant(response.request) and response.status >= 400 else None)
                try:
                    response = page.goto(url, wait_until="load", timeout=30000)
                except BrowserError as exc:
                    # Refusal/timeout is observable, but does not establish
                    # whether the app or its network environment is at fault.
                    if "net::" not in str(exc) and "Timeout" not in str(exc):
                        raise
                    result.update(failure_kind="access_issue", error=str(exc))
                    result["issues"].append("address_unavailable")
                    return result
                result["status"] = response.status if response else None
                if not response or not response.ok:
                    result["issues"].append("http_error")
                elif ready_selector:
                    try:
                        page.locator(ready_selector).first.wait_for(state="visible", timeout=15000)
                    except BrowserError as exc:
                        if "Timeout" not in str(exc) and "selector" not in str(exc).lower():
                            raise
                        result["issues"].append("readiness_unconfirmed")
                        result["readiness_error"] = str(exc)
                # Allow client-side rendering without waiting for long-running
                # polling connections to become idle.
                try:
                    page.wait_for_function("""() => document.body &&
                    (document.body.innerText.trim().length > 0 ||
                     [...document.querySelectorAll('canvas, img, svg')].some(el => {
                       const box = el.getBoundingClientRect();
                       return box.width > 0 && box.height > 0;
                     }))""", timeout=15000)
                except BrowserError as exc:
                    if "Timeout" not in str(exc):
                        raise
                    result["issues"].append("empty_screen")
                page.wait_for_timeout(500)
                result["body_text"] = page.locator("body").inner_text()
                if result["page_errors"] or result["failed_resources"]:
                    result["issues"].append("page_or_resource_error")
                png_path.parent.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(png_path), full_page=True)
                result["capture_ok"] = True
                result["ok"] = not result["issues"]
                result["failure_kind"] = None if result["ok"] else "application_issue"
            finally:
                browser.close()
    except Exception as exc:
        result["failure_kind"] = "environment_error"
        result["error"] = f"{type(exc).__name__}: {exc}"
    return result


def render_html(html_path: Path, png_path: Path, width: int = 1280, height: int = 900) -> bool:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return False
    try:
        png_path.parent.mkdir(parents=True, exist_ok=True)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": width, "height": height})
            page.goto(html_path.resolve().as_uri())
            page.wait_for_timeout(500)
            page.screenshot(path=str(png_path), full_page=True)
            browser.close()
        return True
    except Exception:
        return False


if __name__ == "__main__":
    import sys
    ok = render_html(Path(sys.argv[1]), Path(sys.argv[2]))
    print("rendered" if ok else "skipped (playwright unavailable or error)")
