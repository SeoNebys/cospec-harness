from contextlib import ExitStack
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import harness
import llm
import measurement
import resource_report
import usage_accounting as usage


def native(path, sid, output, parent=None, embedded_parent=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = {'input_tokens': output * 10, 'cached_input_tokens': output * 4, 'output_tokens': output}
    meta = {'id': sid, 'source': 'exec', 'forked_from_id': parent}
    rows = [{'type': 'session_meta', 'payload': meta}]
    if embedded_parent:
        rows.append({'type': 'session_meta', 'payload': {'id': parent, 'source': 'exec'}})
    rows.append({'timestamp': '2026-09-15T00:00:00Z', 'type': 'event_msg',
                 'payload': {'type': 'token_count', 'info': {
                     'total_token_usage': raw, 'last_token_usage': raw}}})
    path.write_text('\n'.join(json.dumps(row) for row in rows) + '\n')
    return raw


class UsageTests(unittest.TestCase):
    def test_child_identity_survives_embedded_parent_and_duplicate_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            native(root/'main.jsonl', 'main', 100)
            native(root/'child.jsonl', 'child', 20, 'main', True)
            (root/'duplicate.jsonl').write_bytes((root/'child.jsonl').read_bytes())
            threads = usage.codex_threads(root)
            self.assertEqual(set(threads), {'main', 'child'})
            result = usage.account_codex({'session_id': 'main'}, {}, threads)
            self.assertEqual(result['usage']['output_tokens'], 120)
            self.assertTrue(result['complete'])

    def test_resumed_call_counts_only_increment_and_child_increment(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            native(root/'main.jsonl', 'main', 100)
            native(root/'child.jsonl', 'child', 20, 'main')
            before = usage.codex_threads(root)
            native(root/'main.jsonl', 'main', 150)
            native(root/'child.jsonl', 'child', 30, 'main')
            after = usage.codex_threads(root)
            result = usage.account_codex({'session_id': 'main'}, before, after, 'main')
            self.assertEqual(result['usage']['output_tokens'], 60)
            self.assertEqual(result['usage']['input_tokens'], 360)

    def test_missing_resume_baseline_and_reset_are_not_full_totals(self):
        result = usage.account_codex({'session_id': 's', 'native_usage': {'output_tokens': 100}}, {}, {}, 's')
        self.assertEqual(result['usage']['output_tokens'], 0)
        self.assertFalse(result['complete'])
        result = usage.account_codex({'session_id': 's', 'native_usage': {'output_tokens': 10}}, {}, {},
                                     's', {'output_tokens': 100})
        self.assertEqual(result['usage']['output_tokens'], 0)
        self.assertIn('cli_counter_reset', result['issues'])

    def test_claude_auxiliary_usage_is_not_lost_or_added_twice(self):
        result = usage.claude_usage({'usage': {'output_tokens': 100}, 'modelUsage': {
            'main': {'outputTokens': 100, 'thinkingTokens': 30}, 'aux': {'outputTokens': 7}}})
        self.assertEqual(result['usage']['output_tokens'], 107)
        self.assertEqual(result['usage']['reasoning_output_tokens'], 30)

    def test_counter_inheritance_does_not_charge_parent_history_to_child(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            native(root/'child.jsonl', 'child', 120, 'parent')
            data = [json.loads(line) for line in (root/'child.jsonl').read_text().splitlines()]
            data[-1]['payload']['info']['last_token_usage'] = {
                'input_tokens': 200, 'cached_input_tokens': 80, 'output_tokens': 20}
            (root/'child.jsonl').write_text('\n'.join(map(json.dumps, data)))
            row = usage.codex_threads(root)['child']
            self.assertEqual(row['own_usage']['output_tokens'], 20)
            self.assertTrue(row['scope_verified'])


class MeasurementTests(unittest.TestCase):
    def test_successful_resumed_calls_persist_additive_usage(self):
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            root = Path(tmp)
            for key in ('MAKER_TS', 'DIRECTOR_TS', 'MAKER_WS', 'SESSION'):
                p = root/key
                p.mkdir()
                stack.enter_context(patch.object(harness, key, p))
            calls = []
            def respond(*args, **kwargs):
                amount = 10 if not calls else 30
                calls.append(amount)
                raw = native(harness.MAKER_TS/'main.jsonl', 'main', amount)
                native(harness.MAKER_TS/'child.jsonl', 'child', 5 if amount == 10 else 10, 'main')
                events = [{'type': 'thread.started', 'thread_id': 'main'},
                          {'type': 'item.completed', 'item': {'type': 'agent_message', 'text': 'Done'}},
                          {'type': 'turn.completed', 'usage': raw}]
                return subprocess.CompletedProcess([], 0, stdout='\n'.join(map(json.dumps, events)), stderr='')
            with patch.object(harness, 'run_llm', side_effect=respond):
                model = llm.select('maker', 'codex')
                first = llm.invoke('maker', model, 'Build', record_dir=root/'calls')
                second = llm.invoke('maker', model, 'Next', 'main', record_dir=root/'calls')
            self.assertEqual(first['usage']['output_tokens'], 15)
            self.assertEqual(second['usage']['output_tokens'], 25)
            self.assertEqual(second['native_usage']['output_tokens'], 30)
            attempts = [json.loads(p.read_text()) for p in (root/'calls/attempts').glob('*.json')]
            self.assertEqual(sum(a['accounting']['usage']['output_tokens'] for a in attempts), 40)
            self.assertTrue(all('elapsed_seconds' in a for a in attempts))

    def test_interrupted_claude_native_messages_are_deduplicated(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            message = {'type': 'assistant', 'message': {'id': 'message-1',
                        'usage': {'output_tokens': 50, 'input_tokens': 10}}}
            (root/'session.jsonl').write_text(json.dumps(message)+'\n'+json.dumps(message)+'\n')
            (root/'copy.jsonl').write_text(json.dumps(message)+'\n')
            result = usage.claude_messages(root)
            self.assertEqual(usage.add(result.values())['output_tokens'], 50)

    def test_failure_time_is_retained_without_exception_contents(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            with patch.object(measurement.time, 'monotonic', side_effect=[10, 25]):
                with self.assertRaises(RuntimeError):
                    with measurement.span(path, 'setup'):
                        raise RuntimeError('private diagnostic')
            record = json.loads(next(path.glob('*.json')).read_text())
            self.assertEqual(record['elapsed_seconds'], 15)
            self.assertEqual(record['outcome'], 'failed')
            self.assertNotIn('private diagnostic', json.dumps(record))
            self.assertEqual(measurement.summarize(path)['operations']['setup']['failed_seconds'], 15)

    def test_timeout_keeps_partial_codex_usage_and_no_replay(self):
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            root = Path(tmp)
            for key in ('MAKER_TS', 'DIRECTOR_TS', 'MAKER_WS', 'SESSION'):
                p = root/key
                p.mkdir()
                stack.enter_context(patch.object(harness, key, p))
            (harness.SESSION/'control.json').write_text('{"interruption":"stop"}')
            def fail(*args, **kwargs):
                native(harness.MAKER_TS/'main.jsonl', 'main', 45)
                raise subprocess.TimeoutExpired('tool', 7200, output=b'{"partial":true}', stderr=b'private')
            with patch.object(harness, 'run_llm', side_effect=fail) as call:
                with self.assertRaises(subprocess.TimeoutExpired):
                    llm.invoke('maker', llm.select('maker', 'codex'), 'Build', record_dir=root/'calls')
                self.assertEqual(call.call_count, 1)
            records = list((root/'calls/attempts').glob('*.json'))
            self.assertEqual(len(records), 1)
            record = json.loads(records[0].read_text())
            self.assertEqual(record['accounting']['usage']['output_tokens'], 45)
            self.assertEqual(record['outcome'], 'failed')
            self.assertNotIn('private', json.dumps(record))
            self.assertGreaterEqual(record['elapsed_seconds'], 0)

    def test_overlapping_interruption_intervals_are_excluded_once(self):
        start = resource_report.timestamp('2026-09-15T00:00:00Z')
        end = resource_report.timestamp('2026-09-15T00:10:00Z')
        a = resource_report.timestamp('2026-09-15T00:02:00Z')
        b = resource_report.timestamp('2026-09-15T00:06:00Z')
        c = resource_report.timestamp('2026-09-15T00:04:00Z')
        self.assertEqual(resource_report.union_seconds([(a, b), (c, end)], start, end), 480)


if __name__ == '__main__':
    unittest.main()
