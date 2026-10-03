import json
import os
import shutil
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
APP_PORT = 4100
PAGE_PORT = 4101


class MetadataPage(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b'''<!doctype html><html><head>
        <title>Designing calm interfaces</title>
        <meta name="description" content="Practical ideas for reducing noise and helping important actions stand out.">
        <meta property="og:site_name" content="Example Journal">
        </head><body>Example article</body></html>'''
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


def wait_for_app(url, timeout=12):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=0.5) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.1)
    raise RuntimeError('Application did not start')


def run():
    temporary = tempfile.mkdtemp(prefix='keep-browser-')
    metadata_server = ThreadingHTTPServer(('127.0.0.1', PAGE_PORT), MetadataPage)
    metadata_thread = threading.Thread(target=metadata_server.serve_forever, daemon=True)
    metadata_thread.start()
    env = os.environ.copy()
    env.update({'PORT': str(APP_PORT), 'BOOKMARK_DATA_FILE': str(Path(temporary) / 'bookmarks.json')})
    app = subprocess.Popen(['node', 'implementation/server.js'], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        wait_for_app(f'http://127.0.0.1:{APP_PORT}/')
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 1360, 'height': 1000})
            page.goto(f'http://127.0.0.1:{APP_PORT}/', wait_until='networkidle')
            page.locator('[data-harness-ready="true"]').wait_for()
            assert page.get_by_text('Nothing here yet.').is_visible()

            # SCN-010: invalid URLs stay available for correction.
            page.get_by_label('Save a web address').fill('not-a-web-address')
            page.get_by_role('button', name='Save bookmark').click()
            page.get_by_text('Enter a complete web address', exact=False).wait_for()
            assert page.get_by_label('Save a web address').input_value() == 'not-a-web-address'

            # SCN-001/014: details are gathered and a new bookmark starts unread.
            page.get_by_label('Save a web address').fill(f'http://127.0.0.1:{PAGE_PORT}/article')
            page.get_by_role('button', name='Save bookmark').click()
            page.get_by_text('Designing calm interfaces', exact=True).wait_for()
            assert page.get_by_text('Example Journal').is_visible()
            assert page.get_by_role('button', name='Unread — mark read').is_visible()
            assert page.locator('#unread-count').inner_text() == '1'

            # SCN-002/005/012: inline edits and notes, with title validation.
            page.get_by_role('button', name='Edit details').click()
            page.get_by_label('Title').fill('')
            page.get_by_role('button', name='Save changes').click()
            page.get_by_text('Add a title so you can recognize', exact=False).wait_for()
            page.get_by_label('Title').fill('Design systems, without the jargon')
            page.get_by_label('Your note').fill('Use this for the redesign kickoff')
            page.get_by_role('button', name='Save changes').click()
            page.get_by_text('Use this for the redesign kickoff').wait_for()

            # SCN-003/011/016: tag add, normalization, filter, and direct removal.
            page.get_by_role('button', name='+ Add tags').click()
            page.get_by_label('Tags').fill('Design, design, WORK')
            page.get_by_role('button', name='Add tags', exact=True).click()
            page.get_by_role('button', name='Remove design tag').wait_for()
            page.get_by_role('button', name='Remove work tag').wait_for()
            assert page.get_by_role('navigation', name='Filter by tag').get_by_role('button', name='design').is_visible()

            # SCN-010: saving the complete address again identifies the existing item.
            page.get_by_label('Save a web address').fill(f'http://127.0.0.1:{PAGE_PORT}/article')
            page.get_by_role('button', name='Save bookmark').click()
            page.get_by_text('Already saved: Design systems, without the jargon').wait_for()
            assert page.locator('#all-count').inner_text() == '1'

            # SCN-004/006/013: tag filtering and every approved saved detail are searchable.
            tag_navigation = page.get_by_role('navigation', name='Filter by tag')
            tag_navigation.get_by_role('button', name='design').click()
            assert page.locator('#result-count').inner_text() == '1 bookmark'
            tag_navigation.get_by_role('button', name='design').click()
            for query in ['systems', 'redesign', 'Practical', 'Example Journal', 'design']:
                page.get_by_label('Search bookmarks').fill(query)
                assert page.locator('#result-count').inner_text() == '1 bookmark'
            page.get_by_label('Search bookmarks').fill('quarterly taxes')
            assert page.get_by_text('No bookmarks match that search.').is_visible()
            page.get_by_role('button', name='Clear search').click()

            page.get_by_role('button', name='Remove work tag').click()
            page.wait_for_function("document.querySelectorAll('[aria-label=\"Remove work tag\"]').length === 0")

            # SCN-007/008/015: unread views, archive, undo, and restore retain status.
            page.locator('.view-button[data-view="unread"]').click()
            assert page.get_by_role('link', name='Design systems, without the jargon').is_visible()
            page.get_by_role('button', name='Unread — mark read').click()
            page.wait_for_function("document.querySelector('#unread-count').textContent === '0'")
            page.get_by_text('Nothing waiting to be read.').wait_for()
            page.locator('.view-button[data-view="all"]').click()
            page.get_by_role('button', name='Mark unread').click()
            page.wait_for_function("document.querySelector('#unread-count').textContent === '1'")
            page.locator('.view-button[data-view="unread"]').click()
            page.get_by_role('button', name='Archive', exact=True).click()
            page.wait_for_function("document.querySelector('#unread-count').textContent === '0'")
            page.wait_for_function("document.querySelector('#archived-count').textContent === '1'")
            page.get_by_role('button', name='Undo').click()
            page.wait_for_function("document.querySelector('#unread-count').textContent === '1'")
            page.get_by_role('button', name='Archive', exact=True).click()
            page.wait_for_function("document.querySelector('#archived-count').textContent === '1'")
            page.locator('.view-button[data-view="archived"]').click()
            page.get_by_role('button', name='Unread — mark read').wait_for()
            page.get_by_role('button', name='Restore').click()
            page.wait_for_function("document.querySelector('#unread-count').textContent === '1'")
            page.locator('.view-button[data-view="unread"]').click()
            page.get_by_role('link', name='Design systems, without the jargon').wait_for()

            # SCN-009/017: named confirmation and final empty state.
            page.get_by_role('button', name='More actions').click()
            page.get_by_role('button', name='Delete permanently').click()
            page.get_by_text('Design systems, without the jargon will be permanently removed.').wait_for()
            page.get_by_role('dialog').get_by_role('button', name='Cancel').click()
            assert page.get_by_role('link', name='Design systems, without the jargon').is_visible()
            page.get_by_role('button', name='More actions').click()
            page.get_by_role('button', name='Delete permanently').click()
            page.get_by_role('dialog').get_by_role('button', name='Delete permanently').click()
            page.wait_for_function("document.querySelector('#all-count').textContent === '0'")
            assert page.locator('#unread-count').inner_text() == '0'
            assert page.locator('#archived-count').inner_text() == '0'
            page.get_by_text('Nothing waiting to be read.').wait_for()
            browser.close()
    finally:
        app.terminate()
        try:
            app.wait(timeout=5)
        except subprocess.TimeoutExpired:
            app.kill()
        metadata_server.shutdown()
        metadata_server.server_close()
        shutil.rmtree(temporary, ignore_errors=True)


if __name__ == '__main__':
    run()
    print('Browser acceptance flow passed')
