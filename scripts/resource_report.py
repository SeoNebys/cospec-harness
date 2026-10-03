"""Recalculate consumption from evidence without changing archived trial results."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

import measurement
import usage_accounting as usage


def read(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def timestamp(value):
    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def union_seconds(intervals, start, end):
    last, total = start, 0.0
    for a, b in sorted((max(start, a), min(end, b)) for a, b in intervals if a < end and b > start and b > a):
        total += max(0.0, (b - max(a, last)).total_seconds())
        last = max(last, b)
    return total


def role_usage(run, role, provider):
    calls_dir = run / 'session/calls' / role
    calls = [read(p) for p in sorted(calls_dir.glob('call-*.json'))]
    attempts = [read(p) for p in sorted((calls_dir / 'attempts').glob('*.json'))]
    legacy_sum = usage.add(c.get('normalized', {}).get('usage', {}) for c in calls)
    if provider == 'codex':
        threads = usage.codex_threads(run / (role + '-transcript'))
        roots = {c.get('normalized', {}).get('session_id') for c in calls}
        roots |= {a.get('session_id') or a.get('requested_session') for a in attempts}
        roots.discard(None)
        if not roots:
            roots = {sid for sid, t in threads.items() if not t['parent_id']}
        selected = set().union(*(usage.descendants(threads, sid) for sid in roots)) if roots else set()
        rows, issues = [], []
        for sid in sorted(selected):
            t = threads.get(sid)
            if t and t['own_usage'] is not None:
                rows.append({'session_id': sid, 'kind': 'main' if sid in roots else 'child',
                             'usage': t['own_usage'], 'scope_verified': t['scope_verified'],
                             'increments_checked': t['increments_checked'], 'files': t['files']})
                issues.extend(t['anomalies'])
            else:
                # Latest CLI cumulative counter is a fallback, never sum all calls.
                counters = [usage.codex_usage(c['normalized']['native_usage']) for c in calls
                            if c.get('normalized', {}).get('session_id') == sid
                            and c['normalized'].get('native_usage')]
                if counters:
                    rows.append({'session_id': sid, 'kind': 'main', 'usage': counters[-1],
                                 'scope_verified': False, 'files': []})
                issues.append('native_thread_missing:' + sid)
        if not rows:
            issues.append('usage_unavailable')
        return {'provider': provider, 'usage': usage.add(r['usage'] for r in rows),
                'main_usage': usage.add(r['usage'] for r in rows if r['kind'] == 'main'),
                'child_usage': usage.add(r['usage'] for r in rows if r['kind'] == 'child'),
                'threads': rows, 'complete': not issues, 'issues': sorted(set(issues)),
                'source': 'distinct native thread counters, including failed/recovered work',
                'previous_call_sum': legacy_sum}
    if attempts:
        accounting = [a.get('accounting', {}) for a in attempts]
        return {'provider': provider, 'usage': usage.add(a.get('usage', {}) for a in accounting),
                'complete': all(a.get('complete', False) for a in accounting),
                'issues': sorted({i for a in accounting for i in a.get('issues', [])}),
                'source': 'attempt records, including failures', 'previous_call_sum': legacy_sum}
    if provider == 'claude':
        accounted = []
        for call in calls:
            try:
                accounted.append(usage.claude_usage(json.loads(call.get('stdout', '{}'))))
            except ValueError:
                accounted.append({'usage': {}, 'complete': False})
        return {'provider': provider, 'usage': usage.add(a['usage'] for a in accounted),
                'complete': False,
                'issues': ['historical_success_calls_only; failed-call usage completeness not established'],
                'source': 'CLI modelUsage including auxiliary models', 'previous_call_sum': legacy_sum}
    return {'provider': provider, 'usage': legacy_sum, 'complete': False,
            'issues': ['historical_reported_usage_scope_unverified'], 'source': 'CLI reported usage'}


def run_report(run, models=None):
    models = models or read(run / 'session/models.json', {})
    roles = {role: role_usage(run, role, models.get(role, {}).get('provider', 'unknown'))
             for role in ('maker', 'director')}
    timing = {'dialogue_operations': measurement.summarize(run / 'session/timing'),
              'model_attempts': {}, 'quota_waits': {}}
    for role in roles:
        directory = run / 'session/calls' / role
        timing['model_attempts'][role] = measurement.summarize(directory / 'attempts')
        timing['quota_waits'][role] = measurement.summarize(directory / 'waits')
    timing['historical_provider_durations'] = {}
    for role in roles:
        rows = []
        for path in (run / 'session/calls' / role).glob('call-*.json'):
            try:
                data = json.loads(read(path).get('stdout', '{}'))
            except ValueError:
                continue
            if isinstance(data, dict) and data.get('duration_ms') is not None:
                rows.append({'call': path.name, 'duration_ms': data['duration_ms'],
                             'duration_api_ms': data.get('duration_api_ms')})
        timing['historical_provider_durations'][role] = rows
    presentations = [read(p) for p in (run / 'session/presentation-attempts').glob('round-*/attempt-*.json')]
    timing['presentation_detail'] = {
        'attempt_seconds': sum(p.get('elapsed_seconds', 0) for p in presentations),
        'retry_wait_seconds': sum(p.get('wait_seconds', 0) for p in presentations),
        'failed_attempt_seconds': sum(p.get('elapsed_seconds', 0) for p in presentations
                                      if p.get('outcome') == 'environment_error')}
    # Exact within-call stage boundaries are absent; preserve observed boundaries.
    timing['phase_observations'] = [{k: a.get(k) for k in
        ('id', 'role', 'started_at', 'elapsed_seconds', 'phase_before', 'phase_after', 'phase_assignment', 'outcome')}
        for role in roles for path in (run / 'session/calls' / role / 'attempts').glob('*.json')
        for a in [read(path)]]
    phase_totals = {}
    for item in timing['phase_observations']:
        observed = item.get('phase_before') or {}
        if item.get('phase_assignment') == 'transition_or_mixed':
            label = 'transition_or_mixed'
        elif observed.get('declared_phase'):
            label = 'declared:' + observed['declared_phase']
        elif observed.get('sdd_artifacts'):
            label = 'available_sdd_artifacts:' + ','.join(observed['sdd_artifacts'])
        elif observed.get('artifact_kind'):
            label = 'presented:' + observed['artifact_kind']
        else:
            label = 'unclassified'
        key = str(item.get('role')) + '/' + label
        if item.get('elapsed_seconds') is not None:
            phase_totals[key] = phase_totals.get(key, 0) + item['elapsed_seconds']
    timing['observed_phase_seconds'] = phase_totals
    return {'roles': roles, 'observed_usage': usage.add(r['usage'] for r in roles.values()),
            'usage_complete': all(r['complete'] for r in roles.values()), 'timing': timing,
            'usage_scope': 'all observed resource consumption, including final dialogue and auxiliary/child sessions; no settled-tail trimming'}


def build_batch(root):
    research = (root / 'runs/execution-state.json').exists()
    state = read(root / 'runs/execution-state.json' if research else root / 'status.json')
    report = {'generated_at': measurement.now(), 'batch': str(root), 'trials': [],
              'definition': 'Observed tokens are not billing or subscription quota. Reasoning tokens are an output subset; cached tokens are separated from uncached input. Timing layers overlap and must not be summed together.'}
    for row in state['trials']:
        result = {k: row.get(k) for k in ('index', 'trial_id', 'block', 'condition', 'run', 'status',
                                        'maker', 'director', 'maker_effort', 'director_effort')}
        if not row.get('started_at'):
            report['trials'].append(result)
            continue
        start = timestamp(row['started_at'])
        stop = row.get('finished_at')
        if not stop and row['status'] in ('failed', 'paused', 'archive_failed'):
            stop = row.get('stopped_at') or state.get('stopped_at')
        end = timestamp(stop or measurement.now())
        run = root / 'runs' / row['condition'] / f"run-{row.get('run', 0):02d}"
        if not (run / 'session').exists():
            candidate = root / '_work'
            ctx = candidate / 'session/context.md'
            context = ctx.read_text() if ctx.exists() else ''
            run = (candidate if f"- condition: {row['condition']}\n" in context
                   and f"- run: {row.get('run')}\n" in context else root / 'missing-trial-evidence')
        gaps = []
        recovery = row.get('recovery', {})
        if recovery.get('interrupted_at') and recovery.get('started_at'):
            gaps.append((timestamp(recovery['interrupted_at']), timestamp(recovery['started_at'])))
        resumes = run / 'session/presentation-resumes.jsonl'
        if resumes.exists():
            for line in resumes.read_text().splitlines():
                event = json.loads(line)
                if event.get('paused_at'):
                    gaps.append((timestamp(event['paused_at']), timestamp(event['resumed_at'])))
        extensions = run / 'session/cap-extensions.jsonl'
        if extensions.exists():
            for line in extensions.read_text().splitlines():
                event = json.loads(line)
                resumed_at = timestamp(event['resumed_at'])
                continuation = row.get('continuation', {})
                if (continuation.get('from_round') == event['previous_rounds'] and
                        continuation.get('preparation_started_at')):
                    resumed_at = min(resumed_at, timestamp(continuation['preparation_started_at']))
                gaps.append((timestamp(event['paused_at']), resumed_at))
        wall = (end - start).total_seconds()
        paused = union_seconds(gaps, start, end)
        result.update(elapsed_seconds=round(wall, 3), interruption_seconds=round(paused, 3),
                      execution_seconds=round(wall - paused, 3), measured_until=end.isoformat(),
                      resources=run_report(run),
                      batch_operations=(row.get('operations') or measurement.summarize(
                          (root / '_work/timing' if research else root / 'timing') / f"trial-{row['index']:03d}")))
        report['trials'].append(result)
    return report


def write_batch(root, output=None):
    output = output or root / 'resource-usage.json'
    report = build_batch(root)
    measurement.save(output, report)
    lines = ['# 시간·토큰 재집계', '',
             '전체 소비를 집계하며 종료 인사·실패한 작업을 임의로 제외하지 않는다. 확인되지 않은 사용량은 누락 가능성을 표시한다. 원시 기록과 기존 결과는 변경하지 않는다.', '',
             '| 조건 | 상태 | 총 경과(분) | 중단 대기(분) | 실행(분) | Maker 출력 토큰 | Director 출력 토큰 |',
             '|---|---|---:|---:|---:|---:|---:|']
    for row in report['trials']:
        if 'resources' not in row:
            continue
        roles = row['resources']['roles']
        lines.append(f"| {row['condition']} | {row['status']} | {row['elapsed_seconds']/60:.1f} | "
                     f"{row['interruption_seconds']/60:.1f} | {row['execution_seconds']/60:.1f} | "
                     f"{roles['maker']['usage']['output_tokens']:,} | {roles['director']['usage']['output_tokens']:,} |")
    lines += ['', '실행 시간은 모델·도구·통신 대기와 환경 준비·보관을 포함하며, 기록된 중단 대기를 제외한다. CPU 시간이나 순수 추론 시간이 아니다.',
              '', '단계 구분은 호출 전후의 선언된 단계·산출물 상태를 기록한다. 전환이 있으면 혼합으로 표시하며 한 호출의 시간을 임의로 분할하지 않는다. 과거에 기록하지 않은 세부 시간은 복원하지 않는다.',
              '', '호출·제시 시간은 대화 시간의 하위 항목이다. 계층 간 시간을 더하지 않는다. 하위 에이전트의 병렬 작업 시간도 시행 경과에 중복 가산하지 않는다.',
              '', '누락 가능성과 세션별 근거는 JSON의 complete/usage_complete, issues, threads, timing 필드를 참조한다.', '']
    output.with_suffix('.md').write_text('\n'.join(lines))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--batch-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    write_batch(args.batch_dir.resolve(), args.output)
