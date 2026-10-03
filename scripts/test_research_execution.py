"""No Docker/model calls: verify block boundaries, quota stops, and Judge gates."""
from contextlib import ExitStack
import copy
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import harness
import judge
import llm
import research_execution as research
import run_matrix as matrix
from test_subscription_quota import POLICY


def coverage():
    return {'core': {f'REF-BM-{i:02d}': 'present' for i in range(1, 23)},
            'extended': {f'REF-BM-{i:02d}': 'absent' for i in range(23, 33)}}


class ScheduleTests(unittest.TestCase):
    def test_committed_schedule_has_150_balanced_trials(self):
        plan, rows = research.load_schedule()
        self.assertEqual(len(rows), 150)
        self.assertEqual({r['block'] for r in rows}, set(range(1, 6)))
        self.assertEqual(len({r['trial_id'] for r in rows}), 150)
        self.assertEqual(plan['trial_schedule']['seed'], 42)

    def test_effort_override_does_not_change_other_roles(self):
        self.assertEqual(llm.select('maker', 'claude', 'low').effort, 'low')
        self.assertEqual(llm.select('director', 'claude').effort, 'medium')
        with self.assertRaises(ValueError):
            llm.select('maker', 'codex', 'invalid')


class ExecutionTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.root = Path(self.stack.enter_context(tempfile.TemporaryDirectory()))
        for key in ('ROOT', 'WORK', 'MAKER_WS', 'MAKER_TS', 'DIRECTOR_WS', 'DIRECTOR_TS',
                    'PRESENTATION', 'SESSION', 'RUNS', 'IMAGE'):
            self.stack.enter_context(patch.object(harness, key, self.root if key == 'ROOT' else getattr(harness, key)))
        matrix.configure(self.root)
        self.stack.enter_context(patch.object(matrix, 'inputs', return_value={}))
        self.stack.enter_context(patch.object(research, 'active_containers', return_value=set()))
        self.stack.enter_context(patch('sys.stdout', new=io.StringIO()))
        self.setup = self.stack.enter_context(patch.object(harness, 'setup', return_value=1))
        self.teardown = self.stack.enter_context(patch.object(harness, 'teardown'))
        self.call = self.stack.enter_context(patch.object(research.broker, 'run_session',
                                                        return_value={'terminated': 'accepted'}))
        self.check = self.stack.enter_context(patch.object(research.quota, 'check',
            return_value={'allowed': True, 'checks': [], 'checked_at': 'now'}))
        self.archive = self.stack.enter_context(patch.object(research, 'check_archive',
                                                             side_effect=lambda row: research.archive_path(row)))
        self.stack.enter_context(patch.object(research.resource_report, 'run_report', return_value={'usage_complete': True}))
        self.stack.enter_context(patch.object(research.resource_report, 'write_batch'))
        self.state = {'inputs': {}, 'image_id': 'image', 'call_timeout_seconds': 10800,
                      'quota_policy': copy.deepcopy(POLICY), 'max_rounds': 80,
                      'judges': {p: llm.select('judge', p).metadata() for p in ('claude', 'codex')},
                      'blocks': {'1': {'status': 'pending'}, '2': {'status': 'pending'}}, 'trials': []}
        for i in range(1, 32):
            self.state['trials'].append(dict(trial_id=f'trial-{i:03d}', order=i, index=i,
                block=1 if i <= 30 else 2, condition='VC', maker='codex', director='claude',
                maker_effort='low', director_effort='medium', status='pending',
                models={'maker': llm.select('maker', 'codex', 'low').metadata(),
                        'director': llm.select('director', 'claude', 'medium').metadata()}))
        research.save(self.state)

    def test_stops_at_30_and_restart_never_replays_or_enters_next_block(self):
        research.execute_trials(self.state, 1)
        self.assertEqual(self.call.call_count, 30)
        self.assertEqual(self.state['status'], 'awaiting_judge')
        self.assertEqual(self.state['trials'][30]['status'], 'pending')
        self.assertEqual(self.setup.call_args_list[0].kwargs['trial']['trial_id'], 'trial-001')
        self.assertEqual(self.call.call_args_list[0].args[4].effort, 'low')
        self.assertEqual(self.check.call_args_list[0].args[0], {'maker': 'codex', 'director': 'claude'})
        research.execute_trials(self.state, 1)
        self.assertEqual(self.call.call_count, 30)
        with self.assertRaisesRegex(RuntimeError, 'finish judging'):
            research.execute_trials(self.state, 2)

    def test_explicit_judge_deferral_runs_only_requested_block_and_preserves_judge_state(self):
        research.execute_trials(self.state, 1)
        self.state['judge_deferrals'] = [{'authorization': 'explicit_user_request',
            'for_block': 2, 'deferred_blocks': [1]}]
        with patch.object(judge, 'run_one') as judge_call:
            research.execute_trials(self.state, 2)
            judge_call.assert_not_called()
        self.assertEqual(self.call.call_count, 31)
        self.assertEqual(self.state['blocks']['1']['status'], 'awaiting_judge')
        self.assertEqual(self.state['blocks']['2']['status'], 'awaiting_judge')
        research.execute_trials(self.state, 2)
        self.assertEqual(self.call.call_count, 31)
        with self.assertRaisesRegex(RuntimeError, 'finish judging'):
            research.verify_trial_prerequisites(self.state, 3)
        with self.assertRaisesRegex(RuntimeError, 'finish judging'):
            research.execute_judges(self.state, 2)

    def test_deferral_requires_explicit_authorization_and_complete_archives(self):
        research.execute_trials(self.state, 1)
        event = {'authorization': 'automatic', 'for_block': 2, 'deferred_blocks': [1]}
        self.state['judge_deferrals'] = [event]
        with self.assertRaisesRegex(RuntimeError, 'finish judging'):
            research.execute_trials(self.state, 2)
        event['authorization'] = 'explicit_user_request'
        self.state['trials'][0]['status'] = 'failed'
        with self.assertRaisesRegex(RuntimeError, 'fully processed'):
            research.execute_trials(self.state, 2)
        self.state['trials'][0]['status'] = 'completed'
        self.archive.side_effect = RuntimeError('Missing archive')
        with self.assertRaisesRegex(RuntimeError, 'Missing archive'):
            research.execute_trials(self.state, 2)
        self.assertEqual(self.call.call_count, 30)

    def test_deferral_still_verifies_previously_completed_judgments(self):
        self.state['blocks']['1']['status'] = 'judged'
        self.state['judge_deferrals'] = [{'authorization': 'explicit_user_request',
            'for_block': 2, 'deferred_blocks': [1]}]
        with patch.object(research, 'verify_judged', side_effect=RuntimeError('Changed judgment')) as verify:
            with self.assertRaisesRegex(RuntimeError, 'Changed judgment'):
                research.execute_trials(self.state, 2)
            verify.assert_called_once_with(self.state, 1)
        self.call.assert_not_called()

    def test_quota_stop_does_not_start_or_consume_trial_then_restart_continues(self):
        self.check.side_effect = [{'allowed': True}, {'allowed': False}]
        research.execute_trials(self.state, 1)
        self.assertEqual(self.call.call_count, 1)
        self.assertEqual(self.state['trials'][1]['status'], 'pending')
        self.assertNotIn('started_at', self.state['trials'][1])
        self.assertEqual(self.state['status'], 'waiting_for_quota')
        self.check.side_effect = None
        research.execute_trials(self.state, 1)
        self.assertEqual(self.call.call_count, 30)

    def test_interrupted_trial_preserves_workspace_and_is_never_replayed(self):
        self.call.side_effect = RuntimeError('interrupted')
        with self.assertRaises(RuntimeError):
            research.execute_trials(self.state, 1)
        self.teardown.assert_not_called()
        self.assertEqual(self.state['trials'][0]['status'], 'failed')
        with self.assertRaisesRegex(RuntimeError, 'no automatic rerun'):
            research.execute_trials(self.state, 1)
        self.assertEqual(self.call.call_count, 1)

    def test_authorized_quota_margin_override_is_scoped_and_audited(self):
        row = self.state['trials'][0]
        self.state['quota_margin_override'] = {'authorization': 'explicit_user_request',
            'block': 1, 'purpose': 'trial', 'trial_ids': [row['trial_id']]}
        self.check.return_value = {'allowed': False, 'checks': [
            {'allowed': False, 'reason': 'insufficient_remaining_quota'},
            {'allowed': True, 'reason': 'within_configured_start_threshold'}]}
        self.assertTrue(research.gate(self.state, row, ['codex', 'claude']))
        self.assertFalse(row['last_quota_check']['allowed_without_override'])
        self.assertFalse(row['last_quota_check']['checks'][0]['allowed'])
        self.assertFalse(research.gate(self.state, self.state['trials'][1], ['codex', 'claude']))
        self.assertFalse(research.gate(self.state, row, ['codex'], 'judge'))
        self.state['quota_margin_override']['authorization'] = 'automatic'
        self.assertFalse(research.gate(self.state, row, ['codex', 'claude']))

    def test_margin_override_does_not_bypass_unknown_or_service_block(self):
        row = self.state['trials'][0]
        self.state['quota_margin_override'] = {'authorization': 'explicit_user_request',
            'block': 1, 'purpose': 'trial', 'trial_ids': [row['trial_id']]}
        for reason in ('service_reports_limit_reached', 'incomplete_quota_reading',
                       'quota_reading_stale', 'required_quota_window_missing'):
            self.check.return_value = {'allowed': False, 'checks': [
                {'allowed': False, 'reason': 'insufficient_remaining_quota'},
                {'allowed': False, 'reason': reason}]}
            self.assertFalse(research.gate(self.state, row, ['codex', 'claude']))

    def test_capped_counts_as_processed_without_replacement(self):
        self.call.return_value = {'terminated': None, 'hit_max_rounds': True}
        research.execute_trials(self.state, 1)
        self.assertEqual(self.call.call_count, 30)
        self.assertTrue(all(r['status'] == 'capped' for r in self.state['trials'][:30]))

    def test_existing_workspace_is_not_overwritten(self):
        harness.SESSION.mkdir(parents=True)
        (harness.SESSION / 'context.md').write_text('old evidence')
        with self.assertRaisesRegex(RuntimeError, 'will not be overwritten'):
            research.execute_trials(self.state, 1)
        self.setup.assert_not_called()

    def test_all_judgments_required_and_valid_results_are_skipped_on_restart(self):
        research.execute_trials(self.state, 1)
        # Use unique archive paths; normally assigned by harness.next_run.
        for i, row in enumerate(self.state['trials'][:30], 1):
            row['run'] = i
        def write(run, mode, model):
            path = judge.result_path(run, model.provider, mode)
            path.parent.mkdir(parents=True, exist_ok=True)
            result = coverage() if mode == 'coverage' else judge.summarise({'decisions': []})
            result['_execution'] = {'model': model.metadata(), 'image_id': 'image'}
            path.write_text(json.dumps(result))
            return path
        with patch.object(judge, 'run_one', side_effect=write) as run:
            research.execute_judges(self.state, 1)
            self.assertEqual(run.call_count, 120)
            self.assertEqual(self.state['blocks']['1']['status'], 'judged')
            research.execute_judges(self.state, 1)
            self.assertEqual(run.call_count, 120)
        research.verify_judged(self.state, 1)
        research.execute_trials(self.state, 2)
        self.assertEqual(self.call.call_count, 31)
        first = judge.result_path(research.archive_path(self.state['trials'][0]), 'claude', 'coverage')
        first.write_text('{}')
        with self.assertRaises(ValueError):
            research.verify_judged(self.state, 1)

    def test_judge_quota_stop_retains_pending_task(self):
        research.execute_trials(self.state, 1)
        self.check.return_value = {'allowed': False}
        with patch.object(judge, 'run_one') as run:
            research.execute_judges(self.state, 1)
            run.assert_not_called()
        self.assertEqual(self.state['trials'][0]['judgments']['claude/coverage']['status'], 'pending')
        self.assertEqual(self.check.call_args.args[0], {'judge': 'claude'})

    def test_two_required_judges_finish_without_replaying_or_erasing_deferred_judge(self):
        research.execute_trials(self.state, 1)
        for i, row in enumerate(self.state['trials'][:30], 1):
            row['run'] = i
        self.state['required_judges'] = ['claude', 'codex']
        self.state['judges']['retired-provider'] = {
            'provider': 'retired-provider', 'model': 'archived-model', 'effort': 'high'}
        failed = {'status': 'failed', 'error_type': 'CallError', 'stopped_at': 'original-stop'}
        self.state['trials'][1]['judgments'] = {'retired-provider/co-construction': dict(failed)}
        def write(run, mode, model):
            self.assertNotEqual(model.provider, 'retired-provider')
            path = judge.result_path(run, model.provider, mode)
            path.parent.mkdir(parents=True, exist_ok=True)
            data = coverage() if mode == 'coverage' else judge.summarise({'decisions': []})
            data['_execution'] = {'model': model.metadata(), 'image_id': 'image'}
            path.write_text(json.dumps(data))
            return path
        with patch.object(judge, 'run_one', side_effect=write) as run:
            research.execute_judges(self.state, 1)
            self.assertEqual(run.call_count, 120)
            research.execute_judges(self.state, 1)
            self.assertEqual(run.call_count, 120)
        self.assertEqual(self.state['trials'][1]['judgments']['retired-provider/co-construction'], failed)
        self.assertIn('retired-provider', self.state['judges'])
        research.verify_judged(self.state, 1)
        research.execute_trials(self.state, 2)
        self.assertEqual(self.call.call_count, 31)

    def test_required_judges_cannot_be_empty_unknown_or_duplicated(self):
        for providers in ([], ['unknown'], ['claude', 'claude']):
            self.state['required_judges'] = providers
            with self.assertRaises(RuntimeError):
                research.required_judges(self.state)

    def test_judge_call_failure_is_not_automatically_replayed(self):
        research.execute_trials(self.state, 1)
        with patch.object(judge, 'run_one', side_effect=RuntimeError('service interrupted')) as run:
            with self.assertRaises(RuntimeError):
                research.execute_judges(self.state, 1)
            with self.assertRaisesRegex(RuntimeError, 'automatic replay'):
                research.execute_judges(self.state, 1)
            self.assertEqual(run.call_count, 1)

    def test_quota_exception_records_stop_before_judge_call(self):
        research.execute_trials(self.state, 1)
        self.state['status'] = 'judging'
        self.check.side_effect = AttributeError('private detail')
        with patch.object(judge, 'run_one') as run:
            with self.assertRaises(AttributeError):
                research.execute_judges(self.state, 1)
            run.assert_not_called()
        saved = json.loads(research.state_path().read_text())
        self.assertEqual(saved['status'], 'stopped_on_quota_error')
        self.assertEqual(saved['waiting_purpose'], 'judge')
        self.assertEqual(saved['quota_error_type'], 'AttributeError')
        self.assertNotIn('private detail', json.dumps(saved))
        self.assertEqual(saved['trials'][0]['judgments']['claude/coverage']['status'], 'pending')

    def test_initialize_loads_state_without_resetting_progress_and_rejects_changed_inputs(self):
        self.state['status'] = 'waiting_for_quota'
        self.state['trials'][0]['status'] = 'completed'
        research.save(self.state)
        rows = [{k: r[k] for k in research.FIELDS} for r in self.state['trials']]
        loaded = research.initialize({}, rows, create=False)
        self.assertEqual(loaded['trials'][0]['status'], 'completed')
        with patch.object(matrix, 'inputs', return_value={'config/llm.yaml': 'changed'}):
            with self.assertRaisesRegex(RuntimeError, 'inputs or timeout changed'):
                research.initialize({}, rows, create=False)

    def test_changed_inputs_block_next_task_before_quota_or_model_calls(self):
        with patch.object(matrix, 'inputs', return_value={'policy': 'changed'}):
            with self.assertRaisesRegex(RuntimeError, 'inputs changed'):
                research.execute_trials(self.state, 1)
        self.check.assert_not_called()
        self.setup.assert_not_called()


class JudgmentValidationTests(unittest.TestCase):
    def test_extract_coverage_with_code_braces_and_explanation(self):
        data = coverage()
        data['notes'] = 'Literal {braces} and "quoted" text'
        for wrapped in (json.dumps(data), '```json\n' + json.dumps(data) + '\n```'):
            raw = '<p>{bookmark.notes}</p> {not JSON} ' + wrapped + '\nEnd {note}.'
            parsed = judge.extract_judgment(raw, {'core', 'extended'})
            self.assertEqual(parsed, data)
            judge.validate_result(parsed, 'coverage')

    def test_extract_co_construction_skips_unrelated_json(self):
        data = {'decisions': [self.infrastructure_note(['REF-BM-01'])]}
        raw = '{"example": {"decisions": []}}\n' + json.dumps(data)
        self.assertEqual(judge.extract_judgment(raw, {'decisions'}), data)

    def test_extract_rejects_missing_malformed_and_ambiguous_judgments(self):
        data = json.dumps(coverage())
        for raw in ('plain text', '{bookmark.notes}', data[:-1], data + '\n' + data,
                    '[' + data + ']', '{"example": ' + data + '}'):
            with self.subTest(raw=raw[:40]), self.assertRaises(ValueError):
                judge.extract_judgment(raw, {'core', 'extended'})

    def test_extraction_does_not_relax_coverage_validation(self):
        data = coverage()
        data['core']['REF-BM-01'] = 'maybe'
        parsed = judge.extract_judgment(json.dumps(data), {'core', 'extended'})
        with self.assertRaises(ValueError):
            judge.validate_result(parsed, 'coverage')

    def infrastructure_note(self, refs=None):
        return {'ref_items': refs or ['REF-BM-I01'], 'diverged': False,
                'response_class': 'not_divergent', 'caught': False, 'catch_type': 'none',
                'evidence': 'round 1: single-user scope agreed', 'note': 'Outside functional scoring'}

    def test_infrastructure_note_is_preserved_separately_without_changing_counts(self):
        functional = dict(self.infrastructure_note(['REF-BM-01']), diverged=True,
                          response_class='corrective', caught=True, catch_type='extend')
        raw = {'decisions': [functional, self.infrastructure_note()]}
        original = copy.deepcopy(raw)
        before = judge.summarise(raw)
        result = judge.summarise_in_scope(raw)
        self.assertEqual(raw, original)
        self.assertEqual(result['decisions'], [functional])
        self.assertEqual(result['excluded_decisions'][0]['decision'], raw['decisions'][1])
        self.assertEqual(result['excluded_decisions'][0]['original_decision_index'], 1)
        for key in before:
            if key != 'decisions':
                self.assertEqual(result[key], before[key])
        judge.validate_result(result, 'co-construction')
        self.assertEqual(judge.summarise_in_scope(result), result)

    def test_unknown_and_mixed_scope_are_not_silently_removed(self):
        for refs in (['REF-BM-I99'], ['REF-BM-99'], ['REF-BM-01', 'REF-BM-I01']):
            with self.subTest(refs=refs), self.assertRaises(ValueError):
                judge.summarise_in_scope({'decisions': [self.infrastructure_note(refs)]})

    def test_unreferenced_nondivergent_note_is_preserved_without_changing_counts(self):
        functional = dict(self.infrastructure_note(['REF-BM-01']), diverged=True,
                          response_class='corrective', caught=True, catch_type='extend')
        note = dict(self.infrastructure_note(), ref_items=[])
        raw = {'decisions': [functional, note]}
        original = copy.deepcopy(raw)
        result = judge.summarise_in_scope(raw)
        self.assertEqual(raw, original)
        self.assertEqual(result['decisions'], [functional])
        self.assertEqual(result['excluded_decisions'], [{
            'original_decision_index': 1, 'reason': 'unreferenced_not_divergent', 'decision': note}])
        for key, value in judge.summarise({'decisions': [functional]}).items():
            self.assertEqual(result[key], value)
        judge.validate_result(result, 'co-construction')
        self.assertEqual(judge.summarise_in_scope(result), result)
        only_note = judge.summarise_in_scope({'decisions': [note]})
        self.assertEqual(only_note['opportunities'], 0)
        self.assertIsNone(only_note['capture_rate'])

    def test_empty_refs_do_not_hide_divergences_or_invalid_flags(self):
        base = dict(self.infrastructure_note(), ref_items=[])
        for changes in (
                {'response_class': 'corrective', 'diverged': True, 'caught': True, 'catch_type': 'correct'},
                {'response_class': 'accepted_divergence', 'diverged': True, 'caught': True},
                {'response_class': 'unexpressed_divergence', 'diverged': True},
                {'response_class': 'unresolved', 'diverged': None},
                {'caught': True}, {'diverged': True}, {'catch_type': 'correct'},
                {'evidence': ''}, {'note': ''}, {'ref_items': None}, {'ref_items': ['']}):
            decision = dict(base, **changes)
            with self.subTest(changes=changes):
                with self.assertRaises(ValueError):
                    judge.summarise_in_scope({'decisions': [decision]})
                with self.assertRaises(ValueError):
                    judge.summarise_in_scope({'decisions': [], 'excluded_decisions': [{
                        'original_decision_index': 0, 'reason': 'unreferenced_not_divergent',
                        'decision': decision}]})

    def test_unreferenced_exclusion_cannot_hide_referenced_decisions(self):
        for refs in (['REF-BM-01'], ['REF-BM-I01'], ['REF-BM-99']):
            with self.subTest(refs=refs), self.assertRaises(ValueError):
                judge.summarise_in_scope({'decisions': [], 'excluded_decisions': [{
                    'original_decision_index': 0, 'reason': 'unreferenced_not_divergent',
                    'decision': self.infrastructure_note(refs)}]})

    def test_infrastructure_scope_is_independent_of_response_class(self):
        functional = [dict(self.infrastructure_note(['REF-BM-01']), diverged=True,
                           response_class='corrective', caught=True, catch_type='extend'),
                      dict(self.infrastructure_note(['REF-BM-02']), diverged=True,
                           response_class='unexpressed_divergence')]
        for response, diverged, caught, catch_type in (
                ('corrective', True, True, 'extend'),
                ('accepted_divergence', True, True, 'none'),
                ('unexpressed_divergence', True, False, 'none'),
                ('unresolved', True, False, 'none'),
                ('unresolved', None, False, 'none'),
                ('not_divergent', False, False, 'none')):
            with self.subTest(response=response, diverged=diverged):
                decision = dict(self.infrastructure_note(), diverged=diverged,
                                response_class=response, caught=caught, catch_type=catch_type)
                raw = {'decisions': [functional[0], decision, functional[1]]}
                original = copy.deepcopy(raw)
                result = judge.summarise_in_scope(raw)
                self.assertEqual(raw, original)
                self.assertEqual(result['excluded_decisions'], [{
                    'original_decision_index': 1,
                    'reason': 'infrastructure_outside_functional_scope', 'decision': decision}])
                for key, value in judge.summarise({'decisions': functional}).items():
                    self.assertEqual(result[key], value)
                judge.validate_result(result, 'co-construction')
                self.assertEqual(judge.summarise_in_scope(result), result)

    def test_infrastructure_only_has_no_functional_opportunities(self):
        decision = dict(self.infrastructure_note(), diverged=True,
                        response_class='unexpressed_divergence')
        result = judge.summarise_in_scope({'decisions': [decision]})
        self.assertEqual(result['decisions'], [])
        self.assertEqual(result['n_m'], 0)
        self.assertEqual(result['opportunities'], 0)
        self.assertIsNone(result['capture_rate'])
        self.assertEqual(result['excluded_decisions'][0]['decision'], decision)

    def test_invalid_infrastructure_class_flags_still_fail(self):
        decision = dict(self.infrastructure_note(), diverged=True,
                        response_class='unexpressed_divergence', caught=True)
        with self.assertRaises(ValueError):
            judge.summarise_in_scope({'decisions': [decision]})
        with self.assertRaises(ValueError):
            judge.summarise_in_scope({'decisions': [], 'excluded_decisions': [{
                'original_decision_index': 0,
                'reason': 'infrastructure_outside_functional_scope', 'decision': decision}]})

    def test_functional_decision_cannot_be_hidden_in_exclusions(self):
        data = judge.summarise({'decisions': []})
        data['excluded_decisions'] = [{'original_decision_index': 0,
            'reason': 'infrastructure_outside_functional_scope',
            'decision': self.infrastructure_note(['REF-BM-01'])}]
        with self.assertRaises(ValueError):
            judge.validate_result(data, 'co-construction')

    def test_coverage_requires_all_items_and_valid_verdicts(self):
        judge.validate_result(coverage(), 'coverage')
        for data in ({}, {'parse_error': True}, {'validation_error': True}):
            with self.assertRaises(ValueError):
                judge.validate_result(data, 'coverage')
        data = coverage()
        data['core']['REF-BM-01'] = 'maybe'
        with self.assertRaises(ValueError):
            judge.validate_result(data, 'coverage')

    def test_co_construction_rejects_fabricated_totals(self):
        data = judge.summarise({'decisions': []})
        judge.validate_result(data, 'co-construction')
        data['n_g'] = 100
        with self.assertRaises(ValueError):
            judge.validate_result(data, 'co-construction')


if __name__ == '__main__':
    unittest.main()
