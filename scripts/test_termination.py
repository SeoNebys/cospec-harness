from contextlib import ExitStack
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import app_presentation
import broker
import harness
import termination


class TerminationTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.root = Path(self.stack.enter_context(tempfile.TemporaryDirectory()))
        for key in ('SESSION', 'RUNS', 'PRESENTATION', 'MAKER_WS'):
            p = self.root / key
            p.mkdir()
            self.stack.enter_context(patch.object(harness, key, p))
        (harness.SESSION / 'control.json').write_text('{"termination":"director_tag"}')
        self.stack.enter_context(patch.object(broker, '_maker_converged', return_value=True))
        self.stack.enter_context(patch.object(broker, '_workspace_sig', return_value=(('app', 1),)))

    def run_round(self, status, message='I accept the app.\n<FINAL_ACCEPTED>'):
        def present(method, rnd):
            d = harness.PRESENTATION / f'round-{rnd:02d}/_running-app'
            d.mkdir(parents=True)
            (d/'status.json').write_text(json.dumps(status))
            return ['http://maker:4000/']
        replies = [{'result': 'Ready', 'session_id': 'maker-session'},
                   {'result': message, 'session_id': 'director-session'}]
        with patch.object(broker, 'curate', side_effect=present), \
                patch.object(broker, '_ask', side_effect=replies) as ask:
            result = broker.run_session('CO-D', 'cospec', 1, 1,
                broker.llm.select('maker', 'codex'), broker.llm.select('director', 'claude'))
        self.assertEqual(ask.call_count, 2)  # Maker's Idle alone cannot skip the Director.
        return result

    def test_final_acceptance_stops_without_another_maker_call(self):
        summary = self.run_round({'artifact_kind': 'application', 'ok': True, 'capture_ok': True})
        self.assertEqual(summary['terminated'], 'accepted')
        log = json.loads((harness.SESSION/'broker-log.json').read_text())
        self.assertEqual(log[-1]['content'], 'I accept the app.')
        self.assertEqual(log[-1]['relayed'], log[-1]['content'])
        self.assertIn(termination.TAG, log[-1]['raw_content'])
        self.assertTrue(log[-1]['control']['final_accepted'])
        self.assertEqual(log[-1]['chars'], len('I accept the app.'))

    def test_acceptance_with_capture_issue_is_completed(self):
        summary = self.run_round({'artifact_kind': 'application', 'ok': False, 'capture_ok': True,
                                  'issues': ['readiness_unconfirmed']})
        self.assertEqual(summary['terminated'], 'accepted')
        self.assertEqual(termination.outcome(summary), 'completed')
        acceptance = json.loads((harness.SESSION/'final-acceptance.json').read_text())
        self.assertNotIn('presentation_verified', acceptance)

    def test_specification_or_prototype_approval_cannot_finish_application(self):
        for kind in ('prototype', None):
            with self.subTest(kind=kind):
                # Fresh presentation directory per subcase.
                import shutil
                shutil.rmtree(harness.PRESENTATION)
                harness.PRESENTATION.mkdir()
                summary = self.run_round({'artifact_kind': kind, 'ok': True, 'capture_ok': True})
                self.assertIsNone(summary['terminated'])
                log = json.loads((harness.SESSION/'broker-log.json').read_text())
                self.assertEqual(log[-1]['control']['invalid_reason'], 'final_implementation_not_presented')

    def test_missing_tag_is_not_inferred_from_approval_wording(self):
        result = self.run_round({'artifact_kind': 'application', 'ok': True, 'capture_ok': True},
                                'I accept the app.')
        self.assertIsNone(result['terminated'])

    def run_unchanged(self, rounds, accept_at=None):
        def present(method, rnd):
            directory = harness.PRESENTATION / f'round-{rnd:02d}/_running-app'
            directory.mkdir(parents=True)
            (directory/'status.json').write_text('{"artifact_kind":"application","ok":true}')
            return []
        replies = []
        for rnd in range(1, rounds + 1):
            replies.extend([{'result': 'The same artifacts.', 'session_id': 'maker-session'},
                            {'result': 'Let us discuss this.' if rnd != accept_at else
                             'I accept the application.\n<FINAL_ACCEPTED>', 'session_id': 'director-session'}])
        with patch.object(broker, 'curate', side_effect=present), \
                patch.object(broker, '_ask', side_effect=replies) as ask:
            summary = broker.run_session('CO-D', 'cospec', 1, rounds,
                broker.llm.select('maker', 'codex'), broker.llm.select('director', 'claude'))
        return summary, ask.call_count

    def test_unchanged_artifacts_without_acceptance_reach_eighty_rounds(self):
        summary, calls = self.run_unchanged(80)
        self.assertEqual(summary['rounds'], 80)
        self.assertTrue(summary['hit_max_rounds'])
        self.assertIsNone(summary['terminated'])
        self.assertEqual(calls, 160)

    def test_final_acceptance_after_unchanged_rounds_still_stops_immediately(self):
        summary, calls = self.run_unchanged(80, accept_at=5)
        self.assertEqual(summary['rounds'], 5)
        self.assertEqual(summary['terminated'], 'accepted')
        self.assertEqual(calls, 10)

    def prepare_cap_extension(self):
        self.run_unchanged(2)
        maker, director = broker.llm.select('maker', 'codex'), broker.llm.select('director', 'claude')
        (harness.SESSION/'models.json').write_text(json.dumps({
            'maker': maker.metadata(), 'director': director.metadata()}))
        (harness.SESSION/'control.json').write_text('{"termination":"director_tag","interruption":"stop"}')
        return maker, director

    def test_manual_failed_call_continuation_keeps_sessions_and_round(self):
        maker, director = self.prepare_cap_extension()
        (harness.SESSION / 'usage-summary.json').unlink()
        continuation = {'authorization': 'explicit_user_request', 'previous_rounds': 2,
                        'started_at': '2026-09-16T00:00:00', 'maker_session': 'maker-session',
                        'director_session': 'director-session', 'prompt_to_maker': 'Let us discuss this.'}
        def present(method, rnd):
            self.assertEqual(rnd, 3)
            path = harness.PRESENTATION / 'round-03/_running-app'
            path.mkdir(parents=True)
            (path / 'status.json').write_text('{"artifact_kind":"application","ok":true}')
            return []
        with patch.object(broker, 'curate', side_effect=present), patch.object(broker, '_ask', side_effect=[
                {'result': 'Ready', 'session_id': 'maker-session'},
                {'result': 'Accepted.\n<FINAL_ACCEPTED>', 'session_id': 'director-session'}]) as ask:
            result = broker.run_session('CO-D', 'cospec', 1, 80, maker, director, continue_failed=continuation)
        self.assertEqual(result['rounds'], 3)
        self.assertEqual(ask.call_args_list[0].args[2:], ('Let us discuss this.', 'maker-session'))
        self.assertEqual(ask.call_args_list[1].args[-1], 'director-session')
        self.assertTrue(termination.stop_on_interruption(harness.SESSION))
        self.assertFalse((harness.SESSION / 'cap-extensions.jsonl').exists())

    def test_failed_call_continuation_requires_explicit_authorization(self):
        maker, director = self.prepare_cap_extension()
        continuation = {'authorization': 'automatic', 'previous_rounds': 2,
                        'maker_session': 'maker-session', 'director_session': 'director-session',
                        'prompt_to_maker': 'Let us discuss this.'}
        with patch.object(broker, '_ask') as ask, self.assertRaises(RuntimeError):
            broker.run_session('CO-D', 'cospec', 1, 80, maker, director, continue_failed=continuation)
        ask.assert_not_called()

    def prepare_presentation_resume(self):
        maker, director = self.prepare_cap_extension()
        path = harness.SESSION / 'broker-log.json'
        log = json.loads(path.read_text())
        log.append({'round': 3, 'role': 'maker', 'session_id': 'maker-session',
                    'content': 'Saved presentation', 'chars': 18, 'artifacts': []})
        path.write_text(json.dumps(log))
        state = {'condition': 'CO-D', 'method': 'cospec', 'run': 1, 'round': 3,
                 'max_rounds': 80, 'started_at': '2026-09-18T00:00:00',
                 'maker': maker.metadata(), 'director': director.metadata(),
                 'maker_session': 'maker-session', 'director_session': 'director-session',
                 'last_sig': None, 'unchanged': 0, 'state': 'paused'}
        broker.presentation_retry.save_checkpoint(state)
        return maker, director, broker.presentation_retry.load_checkpoint()

    def test_manual_presentation_continuation_does_not_replay_maker(self):
        maker, director, state = self.prepare_presentation_resume()
        def present(method, rnd):
            self.assertEqual(rnd, 3)
            path = harness.PRESENTATION / 'round-03/_running-app'
            path.mkdir(parents=True)
            (path/'status.json').write_text('{"artifact_kind":"application","ok":true}')
            return []
        with patch.object(broker, 'curate', side_effect=present), patch.object(broker, '_ask',
                return_value={'result': 'Accepted.\n<FINAL_ACCEPTED>', 'session_id': 'director-session'}) as ask:
            result = broker.run_session('CO-D', 'cospec', 1, 80, maker, director, resume=state,
                                        presentation_authorization='explicit_user_request')
        self.assertEqual(result['rounds'], 3)
        self.assertEqual(ask.call_count, 1)
        self.assertEqual(ask.call_args.args[0], harness.DIRECTOR)
        self.assertEqual(ask.call_args.args[-1], 'director-session')
        self.assertTrue(termination.stop_on_interruption(harness.SESSION))

    def test_manual_director_retry_reuses_saved_presentation_and_session(self):
        maker, director, state = self.prepare_presentation_resume()
        broker.presentation_retry.checkpoint_path().unlink()
        state['authorization'] = 'explicit_user_request'
        path = harness.PRESENTATION / 'round-03/_running-app'
        path.mkdir(parents=True)
        (path/'status.json').write_text('{"artifact_kind":"application","ok":true}')
        with patch.object(broker, 'curate') as curate, patch.object(broker, '_ask',
                return_value={'result': 'Accepted.\n<FINAL_ACCEPTED>', 'session_id': 'director-session'}) as ask:
            result = broker.run_session('CO-D', 'cospec', 1, 80, maker, director, continue_director=state)
        self.assertEqual(result['rounds'], 3)
        self.assertEqual(result['terminated'], 'accepted')
        curate.assert_not_called()
        self.assertEqual(ask.call_count, 1)
        self.assertEqual(ask.call_args.args[0], harness.DIRECTOR)
        self.assertEqual(ask.call_args.args[-1], 'director-session')
        self.assertIn('Saved presentation', ask.call_args.args[2])

    def test_manual_director_retry_rejects_unauthorized_or_altered_log(self):
        maker, director, state = self.prepare_presentation_resume()
        broker.presentation_retry.checkpoint_path().unlink()
        for auth, digest in [('automatic', state['log_sha256']), ('explicit_user_request', 'changed')]:
            state.update(authorization=auth, log_sha256=digest)
            with patch.object(broker, '_ask') as ask, self.assertRaises(RuntimeError):
                broker.run_session('CO-D', 'cospec', 1, 80, maker, director, continue_director=state)
            ask.assert_not_called()

    def test_manual_presentation_rejects_unauthorized_or_changed_checkpoint(self):
        maker, director, state = self.prepare_presentation_resume()
        for auth in (None, 'automatic'):
            with self.subTest(auth=auth), patch.object(broker, '_ask') as ask, self.assertRaises(RuntimeError):
                broker.run_session('CO-D', 'cospec', 1, 80, maker, director, resume=state,
                                   presentation_authorization=auth)
            ask.assert_not_called()
        state['round'] = 4
        with patch.object(broker, '_ask') as ask, self.assertRaises(RuntimeError):
            broker.run_session('CO-D', 'cospec', 1, 80, maker, director, resume=state,
                               presentation_authorization='explicit_user_request')
        ask.assert_not_called()

    def test_cap_extension_keeps_last_prompt_sessions_and_round_number(self):
        maker, director = self.prepare_cap_extension()
        def present(method, rnd):
            self.assertEqual(rnd, 3)
            path = harness.PRESENTATION/'round-03/_running-app'
            path.mkdir(parents=True)
            (path/'status.json').write_text('{"artifact_kind":"application","ok":true}')
            return []
        with patch.object(broker, 'curate', side_effect=present), \
                patch.object(broker, '_ask', side_effect=[
                    {'result': 'Ready', 'session_id': 'maker-session'},
                    {'result': 'Accepted.\n<FINAL_ACCEPTED>', 'session_id': 'director-session'}]) as ask:
            summary = broker.run_session('CO-D', 'cospec', 1, 4, maker, director, continue_capped=True)
        self.assertEqual(summary['rounds'], 3)
        self.assertEqual(summary['terminated'], 'accepted')
        self.assertEqual(ask.call_args_list[0].args[2:], ('Let us discuss this.', 'maker-session'))
        self.assertEqual(ask.call_args_list[1].args[3], 'director-session')
        self.assertEqual(len(json.loads((harness.SESSION/'broker-log.json').read_text())), 7)

    def test_failed_cap_extension_cannot_be_replayed(self):
        maker, director = self.prepare_cap_extension()
        with patch.object(broker, '_ask', side_effect=RuntimeError('call failed')) as ask:
            with self.assertRaisesRegex(RuntimeError, 'call failed'):
                broker.run_session('CO-D', 'cospec', 1, 4, maker, director, continue_capped=True)
            with self.assertRaisesRegex(RuntimeError, 'already attempted'):
                broker.run_session('CO-D', 'cospec', 1, 4, maker, director, continue_capped=True)
            self.assertEqual(ask.call_count, 1)

    def test_tag_parser_ignores_quotes_and_explanations(self):
        for raw in ('<FINAL_ACCEPTED>', 'Please use <FINAL_ACCEPTED> later.',
                    'Example:\n<FINAL_ACCEPTED>\nDo not use it yet.',
                    'Not yet <FINAL_ACCEPTED>\n<FINAL_ACCEPTED>'):
            self.assertEqual(termination.split_response(raw), (raw, False))

    def test_new_contract_fixes_kind_port_and_readiness(self):
        directory = harness.MAKER_WS / '.harness'
        directory.mkdir()
        (directory/'runtime-contract.json').write_text('{}')
        manifest = directory/'app.json'
        manifest.write_text(json.dumps({'kind': 'application', 'port': 4000,
                           'start_command': ['npm', 'start'], 'ready_selector': '#does-not-exist'}))
        app = app_presentation.endpoint(harness.MAKER_WS)
        self.assertEqual(app['ready_selector'], '[data-harness-ready="true"]')
        for value in ({'kind': 'application', 'port': 4001, 'start_command': ['npm']},
                      {'kind': 'prototype', 'port': 4000, 'start_command': ['npm']},
                      {'port': 4000}, {'kind': 'application', 'port': 4000}):
            manifest.write_text(json.dumps(value))
            with self.assertRaises(ValueError):
                app_presentation.endpoint(harness.MAKER_WS)

    def test_capture_and_director_use_different_reachable_addresses(self):
        directory = harness.MAKER_WS / '.harness'
        directory.mkdir()
        (directory/'runtime-contract.json').write_text('{}')
        (directory/'app.json').write_text(json.dumps({'kind': 'application', 'port': 4000,
                                         'start_command': ['npm', 'start']}))
        with patch.object(app_presentation.app_runtime, 'ensure_started', return_value=None), \
                patch.object(harness, 'check_director_route') as route, \
                patch.object(app_presentation, 'render_app', return_value={
                    'ok': True, 'capture_ok': True, 'body_text': 'Ready'}) as capture:
            refs = app_presentation.present(harness.MAKER_WS, harness.PRESENTATION, 1)
        self.assertEqual(capture.call_args.args[0], 'http://127.0.0.1:4000/')
        self.assertEqual(refs[0], 'http://maker:4000/')
        route.assert_called_once_with(4000)


if __name__ == '__main__':
    unittest.main()
