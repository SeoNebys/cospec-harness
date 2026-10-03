"""Server starts are separate from model calls and bounded per round."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import app_runtime
import app_presentation
import broker
import harness
import json


class RuntimeTests(unittest.TestCase):
    def test_published_proxy_is_not_mistaken_for_running_application(self):
        import subprocess
        with patch.object(app_runtime.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1)) as run, \
                patch.object(app_runtime.socket, 'create_connection') as host_probe:
            self.assertFalse(app_runtime.listening('http://127.0.0.1:4000/'))
            self.assertEqual(run.call_args.args[0][:4], ['docker', 'exec', 'maker', 'python3'])
            host_probe.assert_not_called()

    def test_launch_survives_caller_and_does_not_repeat_in_same_round(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Path(tmp)
            app = {'start_command': ['python3', '-m', 'http.server', '4077']}
            with patch.object(app_runtime, 'listening', return_value=False), \
                    patch.object(app_runtime.time, 'monotonic', side_effect=[0, 11]), \
                    patch.object(app_runtime.subprocess, 'run') as launch:
                result = app_runtime.ensure_started(ws, app, 'http://127.0.0.1:4077/', 4)
                self.assertEqual(result['state'], 'not_listening_after_start')
                result = app_runtime.ensure_started(ws, app, 'http://127.0.0.1:4077/', 4)
                self.assertEqual(result['state'], 'already_attempted_this_round')
            self.assertEqual(launch.call_count, 1)
            self.assertEqual(launch.call_args.args[0][:3], ['docker', 'exec', '-d'])

    def test_existing_server_is_not_replaced(self):
        with patch.object(app_runtime, 'listening', return_value=True), \
                patch.object(app_runtime.subprocess, 'run') as launch:
            result = app_runtime.ensure_started(Path('/not-used'), {'start_command': ['npm', 'start']},
                                                'http://127.0.0.1:4077/', 1)
            self.assertEqual(result['state'], 'already_listening')
            launch.assert_not_called()

    def test_invalid_command_metadata_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Path(tmp)
            (ws / '.harness').mkdir()
            for extra in [{'start_command': 'npm start'}, {'start_command': []},
                          {'start_command': ['npm'], 'start_cwd': '/etc'},
                          {'start_command': ['npm'], 'start_cwd': '/work/../etc'}]:
                (ws / '.harness/app.json').write_text(json.dumps({'port': 4000, **extra}))
                with self.assertRaises(ValueError):
                    app_presentation.endpoint(ws)

    def test_maker_post_action_image_and_fresh_preview_both_listed(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Path(tmp) / 'work'
            proto = ws / 'prototypes'
            proto.mkdir(parents=True)
            (proto / 'index.html').write_text('initial state')
            (proto / 'saved.png').write_bytes(b'post-action image')
            with patch.object(harness, 'MAKER_WS', ws), \
                    patch.object(harness, 'PRESENTATION', Path(tmp) / 'presentation'), \
                    patch.object(broker, 'render_html', return_value=True):
                refs = broker.curate('cospec', 6)
            self.assertIn('/presentation/round-06/saved.png', refs)
            self.assertIn('/presentation/round-06/index.png', refs)
            self.assertIn('/presentation/round-06/', broker.director_prompt('See /work/prototypes/saved.png', refs, 6))

    def test_runtime_log_changes_do_not_prevent_settlement(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(harness, 'MAKER_WS', Path(tmp)):
            runtime = Path(tmp) / '.harness/runtime'
            runtime.mkdir(parents=True)
            (Path(tmp) / 'app.py').write_text('app')
            before = broker._workspace_sig()
            (runtime / 'server.log').write_text('requests continue')
            self.assertEqual(before, broker._workspace_sig())


if __name__ == '__main__':
    unittest.main()
