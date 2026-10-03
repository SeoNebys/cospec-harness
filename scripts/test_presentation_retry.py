"""Environment repair must not generate a second Maker response or a new round."""
from contextlib import ExitStack
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import app_presentation
import broker
import harness
import llm
import presentation_retry as retry


class RetryTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.root = Path(self.stack.enter_context(tempfile.TemporaryDirectory()))
        for key, name in [('SESSION', 'session'), ('PRESENTATION', 'presentation'),
                          ('RUNS', 'runs'), ('MAKER_WS', 'maker'), ('DIRECTOR_WS', 'director')]:
            directory = self.root / name
            directory.mkdir()
            self.stack.enter_context(patch.object(harness, key, directory))
        self.stack.enter_context(patch.dict(os.environ, {
            'HARNESS_PRESENTATION_ATTEMPTS': '3', 'HARNESS_PRESENTATION_RETRY_DELAY': '0'}))
        self.stack.enter_context(patch.object(broker, '_workspace_sig', return_value=(('app', 1),)))
        self.stack.enter_context(patch.object(broker, '_maker_converged', return_value=False))
        self.stack.enter_context(patch('sys.stdout', new=io.StringIO()))
        self.maker, self.director = llm.select('maker', 'claude'), llm.select('director', 'codex')

    def response(self, role, text):
        return {'session_id': role + '-session', 'result': text, 'usage': {'output_tokens': 10}}

    def run_session(self, rounds, resume=None):
        return broker.run_session('VC', 'vibe', 1, rounds, self.maker, self.director, resume=resume)

    def test_transient_failure_retries_capture_only_in_same_round(self):
        seen = []
        def capture(method, rnd):
            seen.append(rnd)
            dest = harness.PRESENTATION / f'round-{rnd:02d}'
            dest.mkdir()
            (dest / 'evidence.txt').write_text(str(len(seen)))
            if len(seen) < 3:
                raise app_presentation.PresentationEnvironmentError('browser unavailable')
            return ['/presentation/round-01/evidence.txt']
        with patch.object(broker, 'curate', side_effect=capture), \
                patch.object(broker, '_maker_converged', return_value=True), \
                patch.object(broker, 'STALL_ROUNDS', 0), \
                patch.object(broker, '_ask', side_effect=[self.response('maker', 'Built'),
                                                         self.response('director', 'Looks good')]) as ask:
            summary = self.run_session(1)
        self.assertEqual(seen, [1, 1, 1])
        self.assertEqual(ask.call_count, 2)
        self.assertEqual(summary['total_output_tokens'], 20)
        history = harness.SESSION / 'presentation-attempts/round-01'
        self.assertEqual((history / 'failed-0001/evidence.txt').read_text(), '1')
        self.assertEqual((harness.PRESENTATION / 'round-01/evidence.txt').read_text(), '3')
        self.assertEqual(len(list(history.glob('attempt-*.json'))), 3)
        self.assertFalse(retry.checkpoint_path().exists())

    def pause_in_round_two(self):
        def capture(method, rnd):
            if rnd == 2:
                raise app_presentation.PresentationEnvironmentError('browser unavailable')
            return []
        with patch.object(broker, 'curate', side_effect=capture), \
                patch.object(broker, '_ask', side_effect=[self.response('maker', 'First'),
                    self.response('director', 'Please change it'), self.response('maker', 'Changed')]) as ask:
            with self.assertRaises(retry.PresentationPaused):
                self.run_session(3)
        self.assertEqual(ask.call_count, 3)
        state = retry.load_checkpoint()
        self.assertEqual(state['round'], 2)
        self.assertEqual(state['state'], 'paused')
        self.assertFalse((harness.SESSION / 'usage-summary.json').exists())
        return state

    def test_resume_calls_director_then_next_round_maker(self):
        state = self.pause_in_round_two()
        (harness.SESSION / 'image-id.txt').write_text('saved-image')
        containers = [json.dumps([{'State': {'Running': True}, 'Image': 'saved-image',
                                  'Mounts': [{'Destination': '/work', 'Source': str(ws.resolve())}]}])
                      for ws in (harness.MAKER_WS, harness.DIRECTOR_WS)]
        with patch.object(broker, 'curate', return_value=[]), \
                patch.object(broker.subprocess, 'check_output', side_effect=containers), \
                patch.object(broker, '_ask', side_effect=[self.response('director', 'One more change'),
                    self.response('maker', 'Done'), self.response('director', 'Approved')]) as ask:
            summary = broker.resume_session()
        self.assertEqual([c.args[0] for c in ask.call_args_list], ['director', 'maker', 'director'])
        self.assertIn('# Round 2', ask.call_args_list[0].args[2])
        self.assertEqual(ask.call_args_list[0].args[3], 'director-session')
        self.assertEqual(ask.call_args_list[1].args[2], 'One more change')
        self.assertEqual(ask.call_args_list[1].args[3], 'maker-session')
        log = json.loads((harness.SESSION / 'broker-log.json').read_text())
        self.assertEqual([e['round'] for e in log if e['role'] == 'maker'], [1, 2, 3])
        self.assertEqual(summary['total_output_tokens'], 60)
        self.assertEqual(summary['rounds'], 3)
        self.assertFalse(retry.checkpoint_path().exists())
        self.assertTrue((harness.SESSION / 'presentation-resumes.jsonl').exists())

    def test_pending_state_prevents_reset_and_teardown(self):
        self.pause_in_round_two()
        with patch.object(harness, '_rm_container') as remove:
            with self.assertRaises(RuntimeError):
                harness.setup('VC', self.maker, self.director)
            with self.assertRaises(RuntimeError):
                harness.teardown()
            broker._teardown_safe()
            remove.assert_not_called()
        self.assertEqual(retry.load_checkpoint()['round'], 2)

    def test_new_trial_stops_after_retries_and_rejects_manual_resume(self):
        (harness.SESSION / 'control.json').write_text(json.dumps({
            'termination': 'director_tag', 'interruption': 'stop'}))
        state = self.pause_in_round_two()
        history = harness.SESSION / 'presentation-attempts/round-02'
        self.assertEqual(len(list(history.glob('attempt-*.json'))), 3)
        with patch.object(broker, 'curate') as capture, \
                patch.object(broker, '_ask') as ask, \
                patch.object(broker.subprocess, 'check_output') as inspect:
            with self.assertRaisesRegex(RuntimeError, 'separate trial'):
                broker.resume_session()
            with self.assertRaisesRegex(RuntimeError, 'separate trial'):
                self.run_session(3, resume=state)
            capture.assert_not_called()
            ask.assert_not_called()
            inspect.assert_not_called()
        self.assertEqual(retry.load_checkpoint(), state)

    def test_changed_saved_dialogue_is_not_silently_resumed(self):
        self.pause_in_round_two()
        with (harness.SESSION / 'broker-log.json').open('a') as stream:
            stream.write(' ')
        with self.assertRaises(RuntimeError):
            retry.load_checkpoint()

    def test_reviewable_app_issue_does_not_trigger_environment_retry(self):
        (harness.MAKER_WS / '.harness').mkdir()
        (harness.MAKER_WS / '.harness/app.json').write_text('{"port":4000}')
        with patch.object(harness, 'maker_http_url', return_value='http://172.17.0.2:4000/'), \
                patch.object(app_presentation, 'render_app', return_value={
                    'ok': False, 'capture_ok': False, 'failure_kind': 'access_issue'}) as capture, \
                patch.object(broker, '_ask', side_effect=[self.response('maker', 'Built'),
                    self.response('director', 'I cannot open it')]) as ask:
            self.run_session(1)
        self.assertEqual(capture.call_count, 1)
        self.assertEqual(ask.call_count, 2)
        self.assertFalse(retry.checkpoint_path().exists())

    def test_invalid_retry_limit_is_rejected_before_maker_call(self):
        with patch.dict(os.environ, {'HARNESS_PRESENTATION_ATTEMPTS': '0'}), \
                patch.object(broker, '_ask') as ask:
            with self.assertRaises(ValueError):
                self.run_session(1)
            ask.assert_not_called()


if __name__ == '__main__':
    unittest.main()
