#!/usr/bin/env python3
"""Render a static HTML file to a PNG so the director can 'see' a prototype.

Used by the broker's presentation curation. Requires playwright + chromium:
  pip install playwright && playwright install chromium

Rendering a *running* app (VC/SDD server on APP_PORT) is a documented extension:
navigate playwright to http://localhost:APP_PORT instead of a file:// URL.
Falls back gracefully (returns False) if playwright is unavailable.
"""
from __future__ import annotations

from pathlib import Path


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
