"""Keep the client's final acceptance separate from dialogue and tool checks."""
import json
from pathlib import Path

TAG = '<FINAL_ACCEPTED>'
# Retain needs_verification only for historical results; new acceptance is completed.
TERMINAL_STATUSES = {'completed', 'capped', 'needs_verification', 'incomplete'}


def stop_on_interruption(session: Path) -> bool:
    path = session / 'control.json'
    return path.exists() and json.loads(path.read_text()).get('interruption') == 'stop'


def enabled(session: Path) -> bool:
    path = session / 'control.json'
    return path.exists() and json.loads(path.read_text()).get('termination') == 'director_tag'


def split_response(raw: str) -> tuple[str, bool]:
    lines = raw.rstrip().splitlines()
    if len(lines) > 1 and lines[-1].strip() == TAG and raw.count(TAG) == 1:
        content = '\n'.join(lines[:-1]).rstrip()
        if content.strip():
            return content, True
    return raw, False


def outcome(summary: dict) -> str:
    if summary.get('terminated') == 'accepted_pending_verification':
        return 'needs_verification'
    if summary.get('terminated') == 'stalled_without_acceptance':
        return 'incomplete'
    return 'completed' if summary.get('terminated') else 'capped'
