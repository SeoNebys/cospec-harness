"""Count observed CLI usage once per call/thread; never infer subscription charges."""
from __future__ import annotations

import json
from pathlib import Path

KEYS = ('input_tokens', 'output_tokens', 'cache_read_input_tokens',
        'cache_creation_input_tokens', 'reasoning_output_tokens')


def add(values):
    values = list(values)
    return {k: sum(v.get(k, 0) for v in values) for k in KEYS}


def codex_usage(raw):
    return {'input_tokens': raw.get('input_tokens', 0) - raw.get('cached_input_tokens', 0),
            'output_tokens': raw.get('output_tokens', 0),
            'cache_read_input_tokens': raw.get('cached_input_tokens', 0),
            'cache_creation_input_tokens': raw.get('cache_write_input_tokens', 0),
            'reasoning_output_tokens': raw.get('reasoning_output_tokens', 0)}


def difference(after, before):
    """A counter reset is unknown usage, not zero or another full cumulative total."""
    delta = {k: after.get(k, 0) - before.get(k, 0) for k in set(after) | set(before)}
    return None if any(v < 0 for v in delta.values()) else delta


def codex_threads(directory: Path) -> dict:
    """Read native thread counters, deduplicating archived copies by thread/event.

    Check that total increments equal last-request usage. This establishes the
    observed per-thread accounting scope before combining parent and child rows.
    Fork-inherited initial counters are excluded from the child's own usage.
    """
    threads = {}
    for path in sorted(directory.rglob('*.jsonl')) if directory.exists() else []:
        meta, events = None, []
        with path.open(encoding='utf-8', errors='replace') as stream:
            for line in stream:
                try:
                    item = json.loads(line)
                except ValueError:
                    continue  # A killed CLI may leave an incomplete final line.
                payload = item.get('payload', {})
                # A fork can embed the parent's session_meta later in the file.
                # The first header owns the file and its newly produced usage.
                if item.get('type') == 'session_meta' and meta is None:
                    meta = payload
                info = payload.get('info') if payload.get('type') == 'token_count' else None
                if info and info.get('total_token_usage') is not None:
                    events.append((item.get('timestamp', ''), info))
        if not meta or not meta.get('id'):
            continue
        sid = meta['id']
        source = meta.get('source')
        spawn = (source.get('subagent', {}).get('thread_spawn', {})
                 if isinstance(source, dict) else {})
        row = threads.setdefault(sid, {'session_id': sid,
            'parent_id': spawn.get('parent_thread_id') or meta.get('forked_from_id'),
            'cli_version': meta.get('cli_version'), 'events': {}, 'files': []})
        row['files'].append(str(path))
        for stamp, info in events:
            row['events'][(stamp, json.dumps(info['total_token_usage'], sort_keys=True))] = info
    for row in threads.values():
        prev, baseline, anomalies, count = None, {}, [], 0
        for (stamp, _), info in sorted(row.pop('events').items()):
            current = codex_usage(info['total_token_usage'])
            if current == prev:
                continue
            last = codex_usage(info.get('last_token_usage') or {})
            if prev is None:
                inherited = difference(current, last)
                if row['parent_id'] and inherited is not None:
                    baseline = inherited
                if inherited is None or (not row['parent_id'] and any((inherited or {}).values())):
                    anomalies.append('initial_counter_not_explained_by_first_request')
            elif difference(current, prev) != last:
                anomalies.append('counter_increment_differs_from_last_request')
            prev = current
            count += 1
            row['last_timestamp'] = stamp
        own = difference(prev, baseline) if prev is not None else None
        row.update(cumulative=prev, own_usage=own, inherited_baseline=baseline,
                   increments_checked=count, anomalies=sorted(set(anomalies)),
                   scope_verified=bool(count) and not anomalies and own is not None)
    return threads


def descendants(threads, root_id):
    selected = {root_id} if root_id else set()
    while True:
        extra = {sid for sid, row in threads.items() if row['parent_id'] in selected}
        if extra <= selected:
            return selected
        selected |= extra


def account_codex(result, before, after, requested_session=None, fallback_before=None):
    root = (result or {}).get('session_id') or requested_session
    if not root:
        roots = [sid for sid, row in after.items() if not row['parent_id'] and sid not in before]
        if len(roots) == 1:
            root = roots[0]
    rows, issues = [], []
    selected = descendants(after, root)
    for sid in sorted(selected):
        row = after.get(sid)
        if not row or row['own_usage'] is None:
            continue
        previous = before.get(sid, {}).get('own_usage')
        if previous is None and sid == root and requested_session:
            previous = fallback_before
            if previous is None:
                issues.append('resumed_session_baseline_missing')
                continue
        delta = difference(row['own_usage'], previous or {})
        if delta is None or not row['scope_verified']:
            issues.append('native_counter_scope_or_reset_unresolved:' + sid)
            continue
        rows.append({'session_id': sid, 'kind': 'main' if sid == root else 'child', 'usage': delta,
                     'before': previous or {}, 'after': row['own_usage'],
                     'inherited_baseline': row['inherited_baseline']})
    if not any(r['kind'] == 'main' for r in rows):
        raw = (result or {}).get('native_usage')
        previous = before.get(root, {}).get('own_usage') or fallback_before
        if raw and (not requested_session or previous is not None):
            delta = difference(codex_usage(raw), previous or {})
            if delta is not None:
                rows.append({'session_id': root, 'kind': 'main', 'usage': delta,
                             'before': previous or {}, 'after': codex_usage(raw), 'source': 'cli_fallback'})
            else:
                issues.append('cli_counter_reset')
        else:
            issues.append('main_usage_unavailable')
    if not after:
        issues.append('native_threads_unavailable_child_scope_unknown')
    return {'session_id': root, 'usage': add(r['usage'] for r in rows), 'threads': rows,
            'scope': 'observed_distinct_threads', 'issues': sorted(set(issues)),
            'complete': not issues}


def claude_usage(data):
    """modelUsage includes CLI auxiliary models absent from top-level usage."""
    models = data.get('modelUsage') or {}
    if models:
        rows = {name: {'input_tokens': v.get('inputTokens', 0),
                       'output_tokens': v.get('outputTokens', 0),
                       'cache_read_input_tokens': v.get('cacheReadInputTokens', 0),
                       'cache_creation_input_tokens': v.get('cacheCreationInputTokens', 0),
                       'reasoning_output_tokens': v.get('thinkingTokens', 0)}
                for name, v in models.items()}
        return {'usage': add(rows.values()), 'models': rows, 'scope': 'cli_model_usage',
                'complete': True, 'issues': []}
    raw = data.get('usage') or {}
    return {'usage': {k: raw.get(k, 0) for k in KEYS}, 'scope': 'cli_top_level_usage',
            'complete': False, 'issues': ['model_breakdown_unavailable']}


def claude_messages(directory):
    """Fallback for interrupted calls: deduplicate streamed/native message IDs."""
    messages = {}
    for path in sorted(directory.rglob('*.jsonl')) if directory and directory.exists() else []:
        for line in path.read_text(encoding='utf-8', errors='replace').splitlines():
            try:
                item = json.loads(line)
            except ValueError:
                continue
            message = item.get('message') or {}
            if not isinstance(message, dict):
                continue
            raw, mid = message.get('usage'), message.get('id')
            if not mid or not raw:
                continue
            value = {k: raw.get(k, 0) for k in KEYS}
            value['reasoning_output_tokens'] = (raw.get('output_tokens_details') or {}).get('thinking_tokens', 0)
            prior = messages.get(mid, {})
            messages[mid] = {k: max(prior.get(k, 0), value[k]) for k in KEYS}
    return messages
