"""Durable operation timing; monotonic elapsed time and UTC audit timestamps."""
from contextlib import contextmanager
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import time
import uuid


def now():
    return datetime.now(timezone.utc).isoformat()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


@contextmanager
def span(directory: Path | None, operation: str, **metadata):
    record = {'id': uuid.uuid4().hex, 'operation': operation, 'started_at': now(),
              'outcome': 'running', **metadata}
    path = directory / (record['id'] + '.json') if directory else None
    start = time.monotonic()
    if path:
        save(path, record)
    try:
        yield record
    except BaseException as exc:
        record.update(outcome='failed', error_type=type(exc).__name__)
        raise
    else:
        record['outcome'] = 'completed'
    finally:
        record.update(ended_at=now(), elapsed_seconds=round(time.monotonic() - start, 6))
        if path:
            save(path, record)


def phase(workspace: Path):
    """Observed artifacts/state, not an invented division of work within a call."""
    snapshot = {}
    for name in ('AGENTS.md', 'CLAUDE.md'):
        path = workspace / name
        if path.exists():
            match = re.search(r'^.*current phase\s*:\s*(.+)$', path.read_text(errors='replace'), re.I | re.M)
            if match:
                snapshot['declared_phase'] = match.group(1).strip()
                break
    path = workspace / '.harness/app.json'
    if path.exists():
        try:
            snapshot['artifact_kind'] = json.loads(path.read_text()).get('kind', 'unspecified')
        except ValueError:
            snapshot['artifact_kind'] = 'invalid_manifest'
    snapshot['sdd_artifacts'] = [name for name in ('spec.md', 'plan.md', 'tasks.md')
                                 if any((workspace / 'specs').glob('*/' + name))]
    return snapshot


def summarize(directory):
    groups, unfinished = {}, []
    for path in sorted(directory.glob('*.json')) if directory.exists() else []:
        row = json.loads(path.read_text())
        if row.get('outcome') == 'running':
            unfinished.append(row['id'])
            continue
        key = row['operation']
        group = groups.setdefault(key, {'seconds': 0, 'failed_seconds': 0, 'count': 0})
        seconds = row.get('elapsed_seconds', 0)
        group['seconds'] += seconds
        group['count'] += 1
        if row['outcome'] == 'failed':
            group['failed_seconds'] += seconds
    return {'operations': groups, 'unfinished_records': unfinished,
            'definition': 'Elapsed wall time includes model/tool/transport waits, not CPU or pure inference time.'}
