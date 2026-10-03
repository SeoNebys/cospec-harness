"""Read subscription allowances without inference; never log credentials or raw errors."""
from __future__ import annotations

import json
import math
import queue
import subprocess
import threading
import time
from pathlib import Path
import os
from datetime import datetime, timezone
from functools import lru_cache
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from subscription_auth import AuthStore


class QuotaUnavailable(RuntimeError):
    pass


def now():
    return datetime.now(timezone.utc).isoformat()


def _codex():
    store = AuthStore('codex', 'auth-check')
    store._require_clean()
    store._read_source()
    if (store.source != (Path.home() / '.codex/auth.json').resolve()
            or Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))).resolve() != store.source.parent):
        raise QuotaUnavailable('codex_quota_auth_path_differs_from_experiment')
    process = subprocess.Popen(['codex', 'app-server', '--stdio'], stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    messages = queue.Queue()

    def read():
        for line in process.stdout:
            try:
                messages.put(json.loads(line))
            except ValueError:
                pass
        messages.put(None)

    threading.Thread(target=read, daemon=True).start()

    def send(value):
        process.stdin.write(json.dumps(value) + '\n')
        process.stdin.flush()

    def response(identifier):
        deadline = time.monotonic() + 25
        while time.monotonic() < deadline:
            try:
                value = messages.get(timeout=max(.01, deadline - time.monotonic()))
            except queue.Empty:
                raise QuotaUnavailable('codex_rpc_timeout') from None
            if value is None:
                raise QuotaUnavailable('codex_app_server_exited')
            if value.get('id') == identifier:
                if 'error' in value:
                    raise QuotaUnavailable('codex_rpc_error')
                return value['result']
        raise QuotaUnavailable('codex_rpc_timeout')

    try:
        send({'id': 1, 'method': 'initialize', 'params': {
            'clientInfo': {'name': 'cospec_quota', 'version': '1.0'}}})
        response(1)
        send({'method': 'initialized', 'params': {}})
        send({'id': 2, 'method': 'account/rateLimits/read'})
        result = response(2)
        # Ignore unrelated model pools such as Spark.
        data = (result.get('rateLimitsByLimitId') or {}).get('codex') or result.get('rateLimits')
        if not isinstance(data, dict) or data.get('limitId') not in (None, 'codex'):
            raise QuotaUnavailable('codex_limit_pool_missing')
        windows = []
        for name in ('primary', 'secondary'):
            value = data.get(name)
            if value is not None:
                windows.append({'name': name, 'minutes': value.get('windowDurationMins'),
                                'used_percent': value.get('usedPercent'), 'resets_at': value.get('resetsAt')})
        return {'windows': windows, 'limit_reached': bool(data.get('rateLimitReachedType')),
                'scope': 'returned_codex_windows; absent windows are unknown'}
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        process.stdin.close()
        process.stdout.close()


@lru_cache(maxsize=1)
def _claude_version():
    # This is only the usage request's User-Agent, not an allowance reading.
    # Keep a successfully observed version for this process so a later CLI
    # replacement/removal cannot interrupt otherwise valid quota lookups.
    return subprocess.check_output(['claude', '--version'], text=True,
                                   stderr=subprocess.DEVNULL, timeout=5).split()[0]


def _claude():
    # The same authoritative VM file used by the experiment auth adapter.
    store = AuthStore('claude', 'auth-check')
    store._require_clean()
    auth = json.loads(store._read_source())['claudeAiOauth']
    version = _claude_version()
    request = Request('https://api.anthropic.com/api/oauth/usage', headers={
        'Authorization': 'Bearer ' + auth['accessToken'],
        'anthropic-beta': 'oauth-2025-04-20', 'Accept': 'application/json',
        'User-Agent': 'claude-code/' + version})
    try:
        with urlopen(request, timeout=25) as response:
            data = json.load(response)
    except HTTPError as exc:
        raise QuotaUnavailable(f'claude_http_{exc.code}') from None
    windows = []
    for name, value in data.items():
        if name in ('five_hour', 'seven_day', 'seven_day_opus'):
            if value is not None:
                windows.append({'name': name, 'minutes': 300 if name == 'five_hour' else 10080,
                                'used_percent': value.get('utilization'), 'resets_at': value.get('resets_at')})
    return {'windows': windows, 'limit_reached': False,
            'scope': 'Claude Code subscription endpoint; absent windows are unknown'}


def snapshot(provider):
    started = now()
    try:
        if provider == 'codex':
            result = _codex()
        elif provider == 'claude':
            result = _claude()
        else:
            raise QuotaUnavailable('automatic_quota_lookup_unavailable')
        return dict(result, provider=provider, checked_at=started, available=True)
    except Exception as exc:
        # Exceptions from HTTP/RPC/auth may contain secrets: output only fixed codes.
        error = str(exc) if isinstance(exc, QuotaUnavailable) else type(exc).__name__
        return {'provider': provider, 'checked_at': started, 'available': False, 'error': error}


def timestamp(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return datetime.fromtimestamp(value, timezone.utc).timestamp()
    if not isinstance(value, str):
        raise ValueError('Timestamp must be a number or timezone-aware string')
    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if dt.tzinfo is None:
        raise ValueError('Timestamp requires timezone')
    return dt.timestamp()


def evaluate(reading, policy, current_time=None, role='maker'):
    current_time = time.time() if current_time is None else current_time
    if not reading.get('available'):
        return False, reading.get('error', 'quota_unavailable')
    try:
        age = current_time - timestamp(reading['checked_at'])
        if age < -5 or age > policy['max_age_seconds']:
            return False, 'quota_reading_stale'
        windows = reading['windows']
        required = set(policy['required_window_minutes'][reading['provider']])
        if not required <= {w['minutes'] for w in windows}:
            return False, 'required_quota_window_missing'
        minimum = policy['minimum_remaining_percent'][role]
        if isinstance(minimum, bool) or not isinstance(minimum, (int, float)) or not 0 < minimum <= 100:
            return False, 'quota_threshold_not_configured'
        if reading.get('limit_reached'):
            return False, 'service_reports_limit_reached'
        for window in windows:
            used = window['used_percent']
            if (isinstance(used, bool) or not isinstance(used, (float, int))
                    or not math.isfinite(used) or not 0 <= used <= 100):
                return False, 'invalid_quota_reading'
            # Claude can report a fresh, unused five-hour window without a
            # reset time. Keep the raw null in the audit record; do not invent
            # a deadline or extend this exception to missing/nonzero windows.
            unused_claude_window = (reading['provider'] == 'claude'
                and window.get('name') == 'five_hour' and window['minutes'] == 300
                and used == 0 and 'resets_at' in window and window['resets_at'] is None)
            if not unused_claude_window and timestamp(window['resets_at']) <= current_time:
                return False, 'quota_window_expired_refresh_required'
            if 100 - used < minimum:
                return False, 'insufficient_remaining_quota'
        return True, 'within_configured_start_threshold'
    except (KeyError, TypeError, ValueError, OverflowError):
        return False, 'incomplete_quota_reading'


def check(role_providers, policy, purpose='trial'):
    expected_roles = {'maker', 'director'} if purpose == 'trial' else {'judge'} if purpose == 'judge' else set()
    if not expected_roles or set(role_providers) != expected_roles:
        raise ValueError('Quota checks require explicit providers for every task role')
    checks = []
    readings = {}
    for role, provider in role_providers.items():
        minimum = policy['minimum_remaining_percent'].get(role)
        if provider not in readings:
            readings[provider] = snapshot(provider)
        reading = readings[provider]
        allowed, reason = evaluate(reading, policy, role=role)
        checks.append(dict(reading, role=role, minimum_remaining_percent=minimum,
                           allowed=allowed, reason=reason))
    return {'checked_at': now(), 'purpose': purpose,
            'allowed': bool(checks) and all(c['allowed'] for c in checks), 'checks': checks}
