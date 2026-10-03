#!/usr/bin/env python
"""Gherkin-based acceptance tests: drive the real UI in a browser against a
local fixture site. Starts the fixture server and the app server, runs the
checks, and tears everything down. Exit code 0 = all scenarios passed."""
import os, sys, socket, subprocess, tempfile, time, urllib.request, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

def wait_http(url, timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        try:
            urllib.request.urlopen(url, timeout=1); return True
        except Exception:
            time.sleep(0.2)
    return False

FIX = free_port(); APP = free_port()
DATA = tempfile.mkdtemp(prefix='bm-accept-')
FIXBASE = f'http://127.0.0.1:{FIX}'
APPBASE = f'http://127.0.0.1:{APP}'

fixture = subprocess.Popen(['node', 'test/fixture-server.js'], cwd=ROOT, env={**os.environ, 'PORT': str(FIX)})
app = subprocess.Popen(['node', 'src/server.js'], cwd=ROOT,
                       env={**os.environ, 'PORT': str(APP), 'HOST': '127.0.0.1', 'DATA_DIR': DATA, 'ARCHIVE_BASE': FIXBASE})

passed = 0
failed = []
def check(name, cond):
    global passed
    if cond: passed += 1; print(f'  ✓ {name}')
    else: failed.append(name); print(f'  ✗ {name}')

try:
    assert wait_http(FIXBASE + '/img.png'), 'fixture did not start'
    assert wait_http(APPBASE + '/api/state'), 'app did not start'

    with sync_playwright() as pw:
        b = pw.chromium.launch()
        page = pw.chromium.launch().new_page(viewport={'width': 1000, 'height': 1200})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        # 400/409 from the intentional invalid/duplicate save checks log as failed
        # resource loads in the console; those are expected API responses, not app errors.
        page.on('console', lambda m: errors.append(m.text) if (m.type == 'error' and 'Failed to load resource' not in m.text) else None)
        page.goto(APPBASE)
        page.wait_for_selector('[data-harness-ready="true"]')

        def save(url, note=None, tags=None):
            page.fill('#url', url)
            if tags:
                for t in tags:
                    inp = page.query_selector('#saveTags .tag-entry'); inp.fill(t); inp.press('Enter')
            if note is not None:
                page.fill('#saveNote', note)
            page.click('#saveBtn')
            page.wait_for_timeout(500)

        def titles():
            return page.eval_on_selector_all('.card .title, .card .title-input', 'els=>els.map(e=>e.textContent||e.value)')

        # SCN-001 save + auto details
        save(FIXBASE + '/page', note='**why** saved', tags=['dev'])
        check('SCN-001 saved with auto title', any('Sample Page 1' in t for t in titles()))
        check('SCN-001 preview image present', page.eval_on_selector_all('.card .thumb img', 'e=>e.length') >= 1)
        check('SCN-025 note renders markdown (strong)', page.query_selector('.card .note strong') is not None)
        check('SCN-002 tag chip shown', page.eval_on_selector_all('.card .chip', 'e=>e.some(x=>x.textContent.includes("dev"))'))

        # SCN-008 invalid
        page.fill('#url', 'notalink'); page.click('#saveBtn'); page.wait_for_timeout(200)
        check('SCN-008 invalid link message', 'look like a link' in (page.inner_text('#saveMsg') or ''))

        # SCN-009 duplicate -> edit existing
        save(FIXBASE + '/page')
        check('SCN-009 duplicate warns', 'already saved' in (page.inner_text('#saveMsg') or ''))
        page.click('#gotoDup'); page.wait_for_timeout(300)
        check('SCN-009 opens existing in edit', page.query_selector('.card .title-input') is not None)
        # cancel edit by pressing Done (title unchanged)
        page.eval_on_selector_all('.card .primary-btn', 'els=>{const b=els.find(x=>x.textContent==="Done"); if(b) b.click();}'); page.wait_for_timeout(300)

        # SCN-010 unreadable page saves + edit fields
        save(FIXBASE + '/fail')
        check('SCN-010 unreadable saved in edit mode', page.query_selector('.card .title-input') is not None)
        page.eval_on_selector('.card .title-input', 'e=>e.value="Manual title"')
        page.fill('.card .title-input', 'Manual title')
        page.eval_on_selector_all('.card .primary-btn', 'els=>{const b=els.find(x=>x.textContent==="Done"); b.click();}'); page.wait_for_timeout(300)
        check('SCN-010 manual title saved', any('Manual title' in t for t in titles()))

        # SCN-007 search
        page.fill('#search', '"sample page 1"'); page.wait_for_timeout(200)
        check('SCN-007 phrase search', any('Sample Page 1' in t for t in titles()) and len([t for t in titles() if 'Sample' in t]) == 1)
        page.fill('#search', '#dev'); page.wait_for_timeout(200)
        check('SCN-007 #tag search', all('Manual' not in t for t in titles()))
        page.fill('#search', '(dev OR'); page.wait_for_timeout(200)
        check('SCN-007 malformed falls back (bad flag)', page.eval_on_selector('#search', 'e=>e.classList.contains("bad")'))
        page.fill('#search', ''); page.wait_for_timeout(150)

        # SCN-004 read later + view
        page.eval_on_selector_all('.card .act', 'els=>{const b=els.find(x=>x.textContent.includes("Read later")); b.click();}'); page.wait_for_timeout(300)
        page.eval_on_selector_all('#views button', 'els=>els.find(b=>b.textContent.includes("To read")).click()'); page.wait_for_timeout(200)
        check('SCN-004 to-read view shows flagged', len(page.query_selector_all('.card')) >= 1)
        page.eval_on_selector_all('#views button', 'els=>els.find(b=>b.textContent.includes("All")).click()'); page.wait_for_timeout(200)

        # SCN-005 archive + restore
        n_all = len(page.query_selector_all('.card'))
        page.eval_on_selector_all('.card .act', 'els=>{const b=els.find(x=>x.textContent.includes("Archive")); b.click();}'); page.wait_for_timeout(300)
        check('SCN-005 archive removes from All', len(page.query_selector_all('.card')) == n_all - 1)
        page.eval_on_selector_all('#views button', 'els=>els.find(b=>b.textContent.includes("Archived")).click()'); page.wait_for_timeout(200)
        check('SCN-005 archived view shows it', len(page.query_selector_all('.card')) >= 1)
        page.eval_on_selector_all('.card .act', 'els=>{const b=els.find(x=>x.textContent.includes("Restore")); b.click();}'); page.wait_for_timeout(300)
        page.eval_on_selector_all('#views button', 'els=>els.find(b=>b.textContent.includes("All")).click()'); page.wait_for_timeout(200)

        # SCN-019 snapshot view + SCN-020 archive.org (act on a known-good page = top card)
        save(FIXBASE + '/page5')
        def first_card_click(text):
            page.eval_on_selector('.card', f'c=>{{const b=[...c.querySelectorAll(".act")].find(x=>x.textContent.includes("{text}")); b.click();}}')
        first_card_click('Save a copy'); page.wait_for_timeout(1500)
        check('SCN-019 copy badge appears', page.query_selector('.card .badge.copy') is not None)
        first_card_click('View copy'); page.wait_for_timeout(400)
        check('SCN-019 snapshot viewer opens', page.query_selector('.snap iframe') is not None)
        page.eval_on_selector('.snap .close', 'e=>e.click()'); page.wait_for_timeout(200)
        first_card_click('Save to Internet Archive'); page.wait_for_timeout(900)
        check('SCN-020 archive badge appears', page.query_selector('.card .badge.arch') is not None)

        # SCN-018 saved search
        page.fill('#search', '#dev'); page.wait_for_timeout(150)
        page.eval_on_selector_all('#saveSearchRow button', 'els=>{const b=els.find(x=>x.textContent.includes("Save this search")); b.click();}'); page.wait_for_timeout(150)
        page.eval_on_selector('#saveSearchRow input', 'e=>e.value="Dev links"'); page.fill('#saveSearchRow input', 'Dev links')
        page.eval_on_selector_all('#saveSearchRow button', 'els=>{const b=els.find(x=>x.textContent==="Save"); b.click();}'); page.wait_for_timeout(200)
        check('SCN-018 saved search chip created', page.eval_on_selector_all('.saved-chip', 'e=>e.some(x=>x.textContent.includes("Dev links"))'))
        page.fill('#search', ''); page.wait_for_timeout(150)
        page.eval_on_selector_all('.saved-chip', 'els=>els.find(x=>x.textContent.includes("Dev links")).click()'); page.wait_for_timeout(200)
        check('SCN-018 applying saved search sets query', page.eval_on_selector('#search', 'e=>e.value') == '#dev')
        page.fill('#search', ''); page.wait_for_timeout(150)

        # SCN-006 tag filter
        page.eval_on_selector_all('#tagFilter .fchip', 'els=>{const b=els.find(x=>x.textContent==="dev"); if(b)b.click();}'); page.wait_for_timeout(200)
        check('SCN-006 tag filter narrows', all('Manual' not in t for t in titles()))
        page.eval_on_selector_all('#tagFilter .fchip', 'els=>{const b=els.find(x=>x.textContent==="dev"); if(b)b.click();}'); page.wait_for_timeout(200)

        # SCN-015 sort
        page.select_option('#sort', 'title'); page.wait_for_timeout(200)
        ts = [t for t in titles() if t]
        check('SCN-015 title sort orders alphabetically', ts == sorted(ts, key=str.lower))
        page.select_option('#sort', 'newest'); page.wait_for_timeout(200)

        # SCN-016/017 bulk
        save(FIXBASE + '/page2'); save(FIXBASE + '/page3')
        # select two, re-querying between clicks (each toggle re-renders the list)
        for _ in range(2):
            page.eval_on_selector_all('.card .selbox input', 'els=>{const u=els.find(e=>!e.checked); if(u)u.click();}')
            page.wait_for_timeout(150)
        check('SCN-016 bulk bar shows selection', page.query_selector('#bulkBar:not([hidden])') is not None)
        page.eval_on_selector('#bulkBar .bulk-tag input', 'e=>{e.value="triage"; e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter"}));}'); page.wait_for_timeout(400)
        check('SCN-017 bulk add tag applied', page.eval_on_selector_all('.card .chip', 'e=>e.filter(x=>x.textContent.includes("triage")).length') >= 2)
        page.eval_on_selector_all('#bulkBar button', 'els=>{const b=els.find(x=>x.textContent.includes("Delete")); b.click();}'); page.wait_for_timeout(400)
        check('SCN-017 bulk delete + undo toast', page.query_selector('#toast:not([hidden]) .undo') is not None)
        page.eval_on_selector('#toast .undo', 'e=>e.click()'); page.wait_for_timeout(400)

        # SCN-013 single delete + undo
        before = len(page.query_selector_all('.card'))
        page.eval_on_selector_all('.card .act.danger', 'els=>els[0].click()'); page.wait_for_timeout(300)
        check('SCN-013 delete removes card', len(page.query_selector_all('.card')) == before - 1)
        page.eval_on_selector('#toast .undo', 'e=>e.click()'); page.wait_for_timeout(400)
        check('SCN-013 undo restores', len(page.query_selector_all('.card')) == before)

        # SCN-023/024 preferences: dark, text size, page size + pagination
        page.click('#prefsBtn'); page.wait_for_timeout(200)
        page.eval_on_selector('[data-theme="dark"]', 'e=>e.click()'); page.wait_for_timeout(150)
        check('SCN-023 dark theme applied', page.eval_on_selector('body', 'e=>e.classList.contains("theme-dark")'))
        page.eval_on_selector('[data-textsize="large"]', 'e=>e.click()'); page.wait_for_timeout(150)
        check('SCN-023 large text applied', page.eval_on_selector('body', 'e=>e.classList.contains("text-large")'))
        page.select_option('#pv-page', '5'); page.wait_for_timeout(200)
        page.eval_on_selector('#overlay .modal .close', 'e=>e.click()'); page.wait_for_timeout(150)
        check('SCN-024 page count shown', 'Showing' in (page.inner_text('#pageCount') or ''))

        # SCN-014 change URL + refresh
        page.eval_on_selector_all('.card .edit-inline', 'els=>els[0].click()'); page.wait_for_timeout(200)
        page.eval_on_selector('.card .url-edit', 'e=>e.value=""')
        page.fill('.card .url-edit', FIXBASE + '/page4')
        page.check('.card .refresh-row input')
        page.eval_on_selector_all('.card .primary-btn', 'els=>{const b=els.find(x=>x.textContent==="Done"); b.click();}'); page.wait_for_timeout(600)
        check('SCN-014 url change refreshed details', any('Sample Page 4' in t for t in titles()))

        # SCN-021 import
        bmfile = os.path.join(DATA, 'import.html')
        open(bmfile, 'w').write(
            '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>'
            '<DT><H3>Work</H3><DL><p>'
            f'<DT><A HREF="https://imported.example/a" ADD_DATE="1497830400" TAGS="oss">Imported A</A>'
            '</DL><p></DL><p>')
        page.click('#importBtn'); page.wait_for_timeout(200)
        page.set_input_files('#impFile', bmfile); page.wait_for_timeout(300)
        page.eval_on_selector('#doImport', 'e=>e.click()'); page.wait_for_timeout(500)
        # imported item keeps its 2017 date, so under "newest" sort it is on a later
        # page; search brings it into view to verify title + folder tag.
        page.fill('#search', 'Imported A'); page.wait_for_timeout(300)
        check('SCN-021 import adds bookmark with folder tag', page.eval_on_selector_all('.card .chip', 'e=>e.some(x=>x.textContent.includes("work"))'))
        check('SCN-021 imported keeps original title', any('Imported A' in t for t in titles()))
        page.fill('#search', ''); page.wait_for_timeout(150)

        # SCN-022 export download
        with page.expect_download() as di:
            page.click('#exportBtn'); page.wait_for_timeout(150)
            page.eval_on_selector('#download', 'e=>e.click()')
        dl = di.value
        check('SCN-022 export downloads a file', dl.suggested_filename.endswith('.html'))

        check('no console/page errors', len(errors) == 0)
        if errors: print('  errors:', errors[:5])
        b.close()
finally:
    for proc in (app, fixture):
        try: proc.terminate()
        except Exception: pass

print(f'\n{passed} checks passed, {len(failed)} failed')
if failed:
    print('FAILED:', failed); sys.exit(1)
print('ALL ACCEPTANCE CHECKS PASSED')
