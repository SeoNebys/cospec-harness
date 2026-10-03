"""Offline allowance gates: missing/expired data must never authorize inference."""
import copy
import io
import json
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

import subscription_quota as quota


POLICY = {'minimum_remaining_percent': {'maker': 20, 'director': 10, 'judge': 5}, 'max_age_seconds': 120,
          'required_window_minutes': {'claude': [300, 10080], 'codex': [10080]}}


def reading(provider='codex', used=40):
    windows = [{'name': 'weekly', 'minutes': 10080, 'used_percent': used, 'resets_at': 2000}]
    if provider == 'claude':
        windows.append({'name': 'five_hour', 'minutes': 300, 'used_percent': used, 'resets_at': 1500})
    return {'provider': provider, 'available': True, 'checked_at': '1970-01-01T00:16:40+00:00',
            'windows': windows, 'limit_reached': False}


class QuotaTests(unittest.TestCase):
    def setUp(self):
        quota._claude_version.cache_clear()
        self.addCleanup(quota._claude_version.cache_clear)

    def test_claude_version_cache_preserves_fresh_auth_and_allowance_queries(self):
        payloads = [
            {'seven_day': {'utilization': 10, 'resets_at': '2030-01-02T00:00:00Z'}},
            {'seven_day': {'utilization': 95, 'resets_at': '2030-01-02T00:00:00Z'}},
        ]
        responses = []
        for payload in payloads:
            response = MagicMock()
            response.__enter__.return_value = io.StringIO(json.dumps(payload))
            responses.append(response)
        with patch.object(quota, 'AuthStore') as store, \
                patch.object(quota.subprocess, 'check_output', side_effect=[
                    '2.1.281 (Claude Code)', FileNotFoundError('CLI removed')]) as version, \
                patch.object(quota, 'urlopen', side_effect=responses) as request:
            store.return_value._read_source.side_effect = [
                json.dumps({'claudeAiOauth': {'accessToken': 'first-test-token'}}),
                json.dumps({'claudeAiOauth': {'accessToken': 'refreshed-test-token'}}),
            ]
            first, second = quota._claude(), quota._claude()
        self.assertEqual(version.call_count, 1)
        self.assertEqual(store.return_value._read_source.call_count, 2)
        self.assertEqual(request.call_count, 2)
        self.assertEqual(first['windows'][0]['used_percent'], 10)
        self.assertEqual(second['windows'][0]['used_percent'], 95)
        self.assertEqual(request.call_args_list[1].args[0].get_header('Authorization'),
                         'Bearer refreshed-test-token')
        self.assertNotIn('test-token', str((first, second)))

    def test_missing_claude_version_is_not_cached_as_success(self):
        with patch.object(quota.subprocess, 'check_output', side_effect=[
                FileNotFoundError('CLI missing'), '2.1.281 (Claude Code)']) as version:
            with self.assertRaises(FileNotFoundError):
                quota._claude_version()
            self.assertEqual(quota._claude_version(), '2.1.281')
            self.assertEqual(version.call_count, 2)

    def test_fresh_unused_claude_five_hour_window_with_null_reset(self):
        value = reading('claude')
        value['windows'][1].update(used_percent=0, resets_at=None)
        original = copy.deepcopy(value)
        self.assertTrue(quota.evaluate(value, POLICY, 1000, role='judge')[0])
        self.assertEqual(value, original)
        value['windows'][0]['used_percent'] = 96
        self.assertEqual(quota.evaluate(value, POLICY, 1000, role='judge'),
                         (False, 'insufficient_remaining_quota'))

    def test_null_reset_exception_does_not_allow_unknown_or_stale_windows(self):
        for provider, index, used in [('claude', 1, 1), ('claude', 0, 0), ('codex', 0, 0)]:
            with self.subTest(provider=provider, index=index, used=used):
                value = reading(provider)
                value['windows'][index].update(used_percent=used, resets_at=None)
                self.assertEqual(quota.evaluate(value, POLICY, 1000),
                                 (False, 'incomplete_quota_reading'))
        value = reading('claude')
        value['windows'][1].update(used_percent=0, resets_at=None)
        self.assertFalse(quota.evaluate(value, POLICY, 1201)[0])
        del value['windows'][1]['resets_at']
        self.assertFalse(quota.evaluate(value, POLICY, 1000)[0])

    def test_invalid_timestamp_types_block_without_crashing(self):
        for invalid in (None, True, {}, []):
            for target in ('checked_at', 'resets_at'):
                with self.subTest(invalid=invalid, target=target):
                    value = reading()
                    if target == 'checked_at':
                        value[target] = invalid
                    else:
                        value['windows'][0][target] = invalid
                    self.assertEqual(quota.evaluate(value, POLICY, 1000),
                                     (False, 'incomplete_quota_reading'))

    def test_weekly_only_codex_response_is_supported(self):
        self.assertTrue(quota.evaluate(reading(), POLICY, 1000)[0])

    def test_every_relevant_window_must_have_enough_remaining(self):
        value = reading('claude')
        value['windows'][1]['used_percent'] = 81
        self.assertEqual(quota.evaluate(value, POLICY, 1000), (False, 'insufficient_remaining_quota'))
        value['windows'][1]['used_percent'] = 80
        self.assertTrue(quota.evaluate(value, POLICY, 1000)[0])

    def test_absent_window_stale_expired_and_invalid_readings_block(self):
        mutations = [lambda v: v.update(windows=[]),
                     lambda v: v.update(checked_at='1970-01-01T00:00:00+00:00'),
                     lambda v: v['windows'][0].update(resets_at=999),
                     lambda v: v['windows'][0].update(used_percent=None),
                     lambda v: v['windows'][0].update(used_percent=float('nan')),
                     lambda v: v['windows'][0].update(used_percent=-1),
                     lambda v: v.update(limit_reached=True)]
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                value = reading()
                mutate(value)
                self.assertFalse(quota.evaluate(value, POLICY, 1000)[0])
        value = reading('claude')
        value['windows'].pop()
        self.assertFalse(quota.evaluate(value, POLICY, 1000)[0])

    def test_unknown_threshold_does_not_allow_work(self):
        policy = copy.deepcopy(POLICY)
        policy['minimum_remaining_percent']['maker'] = None
        self.assertFalse(quota.evaluate(reading(), policy, 1000)[0])

    def test_query_failure_never_exposes_exception_text(self):
        with patch.object(quota, '_claude', side_effect=ValueError('secret-token')):
            result = quota.snapshot('claude')
        self.assertFalse(result['available'])
        self.assertNotIn('secret-token', str(result))
        self.assertEqual(result['error'], 'ValueError')

    def test_both_roles_must_pass(self):
        with patch.object(quota, 'snapshot', side_effect=[reading('claude'), reading('codex', 91)]), \
                patch.object(quota.time, 'time', return_value=1000):
            result = quota.check({'maker': 'claude', 'director': 'codex'}, POLICY)
        self.assertFalse(result['allowed'])
        self.assertEqual(len(result['checks']), 2)

    def test_start_threshold_follows_role_when_providers_swap(self):
        def snapshot(provider):
            return reading(provider, 84 if provider == 'codex' else 40)
        with patch.object(quota, 'snapshot', side_effect=snapshot), \
                patch.object(quota.time, 'time', return_value=1000):
            codex_maker = quota.check({'maker': 'codex', 'director': 'claude'}, POLICY)
            codex_director = quota.check({'maker': 'claude', 'director': 'codex'}, POLICY)
        self.assertFalse(codex_maker['allowed'])
        self.assertTrue(codex_director['allowed'])
        for result in (codex_maker, codex_director):
            self.assertEqual({r['role']: r['minimum_remaining_percent'] for r in result['checks']},
                             {'maker': 20, 'director': 10})

    def test_role_threshold_boundaries(self):
        for role, minimum in (('maker', 20), ('director', 10), ('judge', 5)):
            with self.subTest(role=role):
                self.assertTrue(quota.evaluate(reading(used=100-minimum), POLICY, 1000, role=role)[0])
                self.assertFalse(quota.evaluate(reading(used=101-minimum), POLICY, 1000, role=role)[0])

    def test_missing_roles_rejected_before_query(self):
        with patch.object(quota, 'snapshot') as snapshot:
            with self.assertRaises(ValueError):
                quota.check({'maker': 'codex'}, POLICY)
            snapshot.assert_not_called()

    def test_codex_uses_general_pool_instead_of_available_spark_pool(self):
        result = {'rateLimitsByLimitId': {
            'codex_bengalfox': {'limitId': 'codex_bengalfox', 'primary': {
                'usedPercent': 0, 'windowDurationMins': 300, 'resetsAt': 2000}},
            'codex': {'limitId': 'codex', 'primary': {
                'usedPercent': 84, 'windowDurationMins': 10080, 'resetsAt': 2000}, 'secondary': None}}}
        process = MagicMock()
        process.stdout = io.StringIO(json.dumps({'id': 1, 'result': {}}) + '\n' +
                                    json.dumps({'id': 2, 'result': result}) + '\n')
        process.stdin = io.StringIO()
        with patch.object(quota, 'AuthStore') as store, \
                patch.object(quota.subprocess, 'Popen', return_value=process), \
                patch.dict(quota.os.environ, {'CODEX_HOME': str(Path.home() / '.codex')}):
            store.return_value.source = (Path.home() / '.codex/auth.json').resolve()
            value = quota._codex()
        self.assertEqual(len(value['windows']), 1)
        self.assertEqual(value['windows'][0]['used_percent'], 84)
        process.terminate.assert_called_once()

    def test_claude_reads_only_relevant_windows_and_does_not_return_auth(self):
        payload = {'five_hour': {'utilization': 1, 'resets_at': '2030-01-01T00:00:00Z'},
                   'seven_day': {'utilization': 17, 'resets_at': '2030-01-02T00:00:00Z'},
                   'seven_day_opus': None,
                   'seven_day_sonnet': {'utilization': 99, 'resets_at': '2030-01-02T00:00:00Z'}}
        with patch.object(quota, 'AuthStore') as store, \
                patch.object(quota.subprocess, 'check_output', return_value='2.1.273 (Claude Code)'), \
                patch.object(quota, 'urlopen') as urlopen:
            store.return_value._read_source.return_value = json.dumps({'claudeAiOauth': {'accessToken': 'test-secret'}})
            urlopen.return_value.__enter__.return_value = io.StringIO(json.dumps(payload))
            value = quota._claude()
        self.assertEqual([w['name'] for w in value['windows']], ['five_hour', 'seven_day'])
        self.assertNotIn('test-secret', str(value))


if __name__ == '__main__':
    unittest.main()
