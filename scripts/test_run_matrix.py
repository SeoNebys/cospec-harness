"""Balanced scheduling and unattended failure behavior."""
from contextlib import ExitStack
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import run_matrix as matrix
import harness
import presentation_retry


class MatrixTests(unittest.TestCase):
    def test_balanced_reproducible_twenty(self):
        rows = matrix.schedule()
        self.assertEqual(len(rows), 20)
        self.assertEqual(len({(r['condition'], r['maker'], r['director']) for r in rows}), 20)
        self.assertEqual(rows, matrix.schedule())
        self.assertNotEqual(rows, matrix.schedule(43))

    def test_fixed_pair_covers_each_condition_once(self):
        rows = matrix.schedule(maker='codex', director='claude')
        self.assertEqual(len(rows), 5)
        self.assertEqual({r['condition'] for r in rows}, set(harness.load_conditions()))
        self.assertTrue(all(r['maker'] == 'codex' and r['director'] == 'claude' for r in rows))

    def run_case(self, fail=False, capped=False, fixed_pair=False):
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            root = Path(directory)
            for key in ('ROOT', 'WORK', 'MAKER_WS', 'MAKER_TS', 'DIRECTOR_WS',
                        'DIRECTOR_TS', 'PRESENTATION', 'SESSION', 'RUNS', 'IMAGE'):
                stack.enter_context(patch.object(harness, key, root if key == 'ROOT' else getattr(harness, key)))
            stack.enter_context(patch.object(matrix, 'inputs', return_value={}))
            stack.enter_context(patch.object(matrix, 'active_roles', return_value=set()))
            stack.enter_context(patch.object(matrix.subprocess, 'check_output', return_value='sha256:test'))
            stack.enter_context(patch('sys.stdout', new=io.StringIO()))
            setup = stack.enter_context(patch.object(harness, 'setup', return_value=1))
            teardown = stack.enter_context(patch.object(harness, 'teardown'))
            call = stack.enter_context(patch.object(matrix.broker, 'run_session',
                side_effect=presentation_retry.PresentationPaused('browser') if fail else None,
                return_value={'terminated': None if capped else 'settled'}))
            if fail:
                stack.enter_context(patch.object(presentation_retry, 'checkpoint_path',
                    return_value=root / 'nonexistent-checkpoint'))
                with self.assertRaises(presentation_retry.PresentationPaused):
                    matrix.execute(root / 'batch')
                self.assertEqual(call.call_count, 1)
                teardown.assert_not_called()
                state = json.loads((root / 'batch/status.json').read_text())
                self.assertEqual(sum(r['status'] == 'pending' for r in state['trials']), 19)
            else:
                options = dict(maker_provider='codex', director_provider='claude', max_rounds=60, validation=True) if fixed_pair else {}
                matrix.execute(root / 'batch', **options)
                count = 5 if fixed_pair else 20
                self.assertEqual(call.call_count, count)
                self.assertEqual(teardown.call_count, count)
                state = json.loads((root / 'batch/status.json').read_text())
                self.assertTrue(all(r['status'] == ('capped' if capped else 'completed') for r in state['trials']))
                if fixed_pair:
                    self.assertEqual(state['max_rounds'], 60)
                    self.assertTrue(state['excluded_from_research_runs'])
                    self.assertTrue(all(c.args[3] == 60 for c in call.call_args_list))
                matrix.execute(root / 'batch')
                self.assertEqual(setup.call_count, count)  # Completed attempts are never silently repeated.

    def test_fixed_pair_executes_five_with_sixty_round_cap(self):
        self.run_case(fixed_pair=True)

    def test_twenty_then_restart_skips_existing(self):
        self.run_case()

    def test_error_preserves_workspace_and_stops_queue(self):
        self.run_case(fail=True)

    def test_capped_is_distinct_and_not_automatically_replaced(self):
        self.run_case(capped=True)

    def test_archive_recovery_does_not_call_models_or_resume_queue(self):
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            root = Path(tmp)
            for key in ('ROOT', 'WORK', 'MAKER_WS', 'MAKER_TS', 'DIRECTOR_WS',
                        'DIRECTOR_TS', 'PRESENTATION', 'SESSION', 'RUNS'):
                stack.enter_context(patch.object(harness, key, root if key == 'ROOT' else getattr(harness, key)))
            matrix.configure(root)
            harness.SESSION.mkdir(parents=True)
            models = {role: matrix.llm.select(role, 'claude').metadata() for role in ('maker', 'director')}
            summary = {'condition': 'SD-D', 'run': 1, 'terminated': 'settled', 'ended_at': 'saved-end'}
            (harness.SESSION / 'usage-summary.json').write_text(json.dumps(summary))
            (harness.SESSION / 'models.json').write_text(json.dumps(models))
            (harness.SESSION / 'context.md').write_text('- condition: SD-D\n- run: 1\n')
            (harness.SESSION / 'image-id.txt').write_text('old-image')
            state = {'image_id': 'old-image', 'inputs': {'unchanged': 'old-policy-hash'},
                     'models': {r: {'claude': m} for r, m in models.items()},
                     'trials': [{'condition': 'SD-D', 'run': 1, 'status': 'failed',
                                 'maker': 'claude', 'director': 'claude', 'error': 'broken link'},
                                {'condition': 'VC', 'status': 'pending'}]}
            matrix.save(root / 'status.json', state)
            with patch.object(harness, 'archive_current_run', return_value=root/'archive') as archive, \
                    patch.object(harness, 'teardown') as teardown, \
                    patch.object(matrix.broker, 'run_session') as run:
                matrix.recover_archive(root)
            archive.assert_called_once()
            teardown.assert_not_called()
            run.assert_not_called()
            saved = json.loads((root / 'status.json').read_text())
            self.assertEqual(saved['inputs'], state['inputs'])
            self.assertEqual(saved['trials'][0]['summary'], summary)
            self.assertEqual(saved['trials'][0]['archive_error_before_recovery'], 'broken link')
            self.assertEqual(saved['trials'][1]['status'], 'pending')
            self.assertEqual(saved['status'], 'stopped_after_archive_recovery')


if __name__ == '__main__':
    unittest.main()
