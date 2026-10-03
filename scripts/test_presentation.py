"""Verify that COSPEC presentation preserves executable prototype bundles."""
import tempfile
import json
import unittest
from pathlib import Path
from unittest.mock import patch

import broker
import harness
import app_presentation


class PresentationTests(unittest.TestCase):
    def test_app_endpoint_rejects_external_addresses_and_invalid_ports(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / '.harness').mkdir()
            manifest = root / '.harness/app.json'
            for value in ({'port': True}, {'port': 0}, {'port': 65536},
                          {'port': 4000, 'path': '//other-host/'},
                          {'port': 4000, 'path': '/\\other-host/'},
                          {'port': 4000, 'ready_selector': ''}):
                with self.subTest(value=value):
                    manifest.write_text(json.dumps(value))
                    with self.assertRaises(ValueError):
                        app_presentation.endpoint(root)

    def test_vibe_does_not_capture_an_unserved_html_entry_point(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ws = root / 'work'
            ws.mkdir()
            (ws / 'index.html').write_text('<script src="/assets/app.js"></script>')
            with patch.object(harness, 'MAKER_WS', ws), \
                    patch.object(harness, 'PRESENTATION', root / 'presentation'), \
                    patch.object(broker, 'render_html') as render:
                self.assertEqual(broker.curate('vibe', 1), [])
                render.assert_not_called()

    def test_http_capture_uses_manifest_and_preserves_failure_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / '.harness').mkdir()
            (root / '.harness/app.json').write_text(json.dumps(
                {'port': 4000, 'path': '/bookmarks', 'ready_selector': '#root > *'}))
            dest = root / 'presentation'
            dest.mkdir()
            failure = {'ok': False, 'failure_kind': 'environment_error',
                       'error': 'Browser executable unavailable'}
            with patch.object(harness, 'maker_http_url', return_value='http://172.17.0.2:4000/bookmarks') as url, \
                    patch.object(app_presentation, 'render_app', return_value=failure) as render:
                with self.assertRaises(RuntimeError):
                    app_presentation.present(root, dest, 2)
            url.assert_called_once_with(4000, '/bookmarks')
            self.assertEqual(render.call_args.args[0], 'http://172.17.0.2:4000/bookmarks')
            self.assertEqual(render.call_args.args[2], '#root > *')
            self.assertEqual(json.loads((dest / '_running-app/status.json').read_text()), failure)
            self.assertFalse((dest / '_running-app/screen.png').exists())

    def test_reviewable_failures_are_delivered_for_all_conditions(self):
        for cid, condition in harness.load_conditions().items():
            for kind in ('application_issue', 'access_issue'):
                with self.subTest(condition=cid, failure=kind), tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    (root / '.harness').mkdir()
                    (root / '.harness/app.json').write_text('{"port":4000}')
                    failure = {'ok': False, 'capture_ok': False, 'failure_kind': kind}
                    with patch.object(harness, 'MAKER_WS', root), \
                            patch.object(harness, 'PRESENTATION', root / 'presentation'), \
                            patch.object(harness, 'maker_http_url', return_value='http://172.17.0.2:4000/'), \
                            patch.object(app_presentation, 'render_app', return_value=failure):
                        refs = broker.curate(condition['method'], 1)
                    self.assertIn('/presentation/round-01/_running-app/notice.txt', refs)
                    self.assertFalse(any(ref.endswith('.png') for ref in refs))
                    self.assertTrue(app_presentation.has_review_issue(root / 'presentation/round-01'))

    def test_malformed_maker_metadata_can_receive_client_feedback(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / '.harness').mkdir()
            (root / '.harness/app.json').write_text('invalid JSON')
            dest = root / 'presentation'
            dest.mkdir()
            refs = app_presentation.present(root, dest, 1)
            self.assertEqual(refs, ['/presentation/round-01/_running-app/notice.txt'])
            status = json.loads((dest / '_running-app/status.json').read_text())
            self.assertEqual(status['failure_kind'], 'metadata_issue')

    def test_docker_lookup_failure_is_an_environment_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / '.harness').mkdir()
            (root / '.harness/app.json').write_text('{"port":4000}')
            dest = root / 'presentation'
            dest.mkdir()
            with patch.object(harness, 'maker_http_url', side_effect=RuntimeError('Docker unavailable')):
                with self.assertRaises(app_presentation.PresentationEnvironmentError):
                    app_presentation.present(root, dest, 1)
            self.assertEqual(json.loads((dest / '_running-app/status.json').read_text())['failure_kind'],
                             'environment_error')

    def test_failed_app_still_reaches_director_and_next_maker_turn(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            session = root / 'session'
            session.mkdir()
            feedback = 'The application did not load. Please check it.'
            responses = [
                {'result': 'Done', 'session_id': 'maker-session'},
                {'result': feedback, 'session_id': 'director-session'},
                {'result': 'I made a change', 'session_id': 'maker-session'},
                {'result': 'It still does not load', 'session_id': 'director-session'}]
            with patch.object(harness, 'SESSION', session), \
                    patch.object(harness, 'RUNS', root / 'runs'), \
                    patch.object(harness, 'PRESENTATION', root / 'presentation'), \
                    patch.object(broker, '_ask', side_effect=responses) as ask, \
                    patch.object(broker, 'curate', return_value=['/presentation/notice.txt']), \
                    patch.object(app_presentation, 'has_review_issue', return_value=True), \
                    patch.object(broker, '_maker_converged', return_value=True), \
                    patch.object(broker, '_workspace_sig', return_value=()), \
                    patch.object(broker, 'STALL_ROUNDS', 0):
                summary = broker.run_session('VC', 'vibe', 1, 2,
                                             broker.llm.select('maker', 'claude'),
                                             broker.llm.select('director', 'codex'))
            self.assertEqual(ask.call_count, 4)
            self.assertEqual(ask.call_args_list[2].args[2], feedback)
            self.assertIsNone(summary['terminated'])
            self.assertTrue(summary['hit_max_rounds'])

    def test_environment_failure_preserves_maker_response_before_stopping(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            with patch.object(harness, 'SESSION', root), \
                    patch.object(broker, '_ask', return_value={'result': 'Saved work', 'session_id': 'm'}) as ask, \
                    patch.object(broker, 'curate', side_effect=app_presentation.PresentationEnvironmentError('capture failed')):
                with self.assertRaises(app_presentation.PresentationEnvironmentError):
                    broker.run_session('VC', 'vibe', 1, 2,
                                       broker.llm.select('maker', 'claude'),
                                       broker.llm.select('director', 'codex'))
            log = json.loads((root / 'broker-log.json').read_text())
            self.assertEqual(log[-1]['content'], 'Saved work')
            self.assertEqual(log[-1]['presentation_error']['kind'], 'environment_error')
            self.assertEqual(ask.call_count, 1)

    def test_runtime_contract_is_preserved_for_both_maker_providers(self):
        for provider in ('claude', 'codex'):
            with self.subTest(provider=provider), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                (root / 'CLAUDE.md').write_text('Existing method instructions')
                harness.install_runtime_policy(root)
                harness.adapt_policy(root, provider)
                text = (root / harness.policy_filename(provider)).read_text()
                self.assertIn('Existing method instructions', text)
                self.assertIn('/work/.harness/app.json', text)

    def test_nested_assets_and_same_named_pages_survive(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ws, presentation = root / 'work', root / 'presentation'
            proto = ws / 'prototypes'
            (proto / 'assets').mkdir(parents=True)
            (proto / 'assets/app.js').write_text('window.ready = true;')
            (proto / 'assets/style.css').write_text('body { color: blue; }')
            (ws / 'context').mkdir()
            (ws / 'context/private.md').write_text('not a client artifact')
            for name in ('a', 'b'):
                (proto / name).mkdir()
                (proto / name / 'index.html').write_text('<script src="../assets/app.js"></script>')
            with patch.object(harness, 'MAKER_WS', ws), patch.object(harness, 'PRESENTATION', presentation), \
                    patch.object(broker, 'render_html', return_value=True) as render:
                refs = broker.curate('cospec', 4)
            dest = presentation / 'round-04'
            self.assertEqual((dest / 'assets/app.js').read_bytes(), (proto / 'assets/app.js').read_bytes())
            self.assertTrue((dest / 'assets/style.css').exists())
            self.assertFalse((dest / 'context').exists())
            self.assertIn('/presentation/round-04/a/index.html', refs)
            self.assertIn('/presentation/round-04/b/index.html', refs)
            self.assertEqual([c.args[0] for c in render.call_args_list],
                             [dest / 'a/index.html', dest / 'b/index.html'])

    def test_screenshot_does_not_overwrite_an_asset(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            proto = root / 'work/prototypes'
            proto.mkdir(parents=True)
            (proto / 'index.html').write_text('<img src="index.png">')
            (proto / 'index.png').write_bytes(b'original image')
            def render(html, png):
                png.write_bytes(b'screenshot')
                return True
            with patch.object(harness, 'MAKER_WS', root / 'work'), \
                    patch.object(harness, 'PRESENTATION', root / 'presentation'), \
                    patch.object(broker, 'render_html', side_effect=render):
                refs = broker.curate('cospec', 1)
            dest = root / 'presentation/round-01'
            self.assertEqual((dest / 'index.png').read_bytes(), b'original image')
            self.assertIn('/presentation/round-01/index.preview.png', refs)

    def test_link_cannot_expose_nonprototype_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            proto = root / 'work/prototypes'
            proto.mkdir(parents=True)
            private = root / 'work/private.md'
            private.write_text('private')
            (proto / 'linked.md').symlink_to(private)
            with patch.object(harness, 'MAKER_WS', root / 'work'), \
                    patch.object(harness, 'PRESENTATION', root / 'presentation'):
                with self.assertRaises(ValueError):
                    broker.curate('cospec', 1)


if __name__ == '__main__':
    unittest.main()
