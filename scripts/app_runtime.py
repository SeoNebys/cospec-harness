"""Start Maker-declared servers outside the lifetime of an LLM tool call."""
import json
from pathlib import Path
import socket
import subprocess
import time
from urllib.parse import urlsplit

import harness


# Runs under a detached Docker exec, not under the model CLI. No shell parsing
# of the supplied argv, and no access to the Docker socket from the Maker.
LAUNCH = """
import json, os, subprocess, sys
from pathlib import Path
command, cwd = json.loads(sys.argv[1]), sys.argv[2]
runtime = Path('/work/.harness/runtime')
with (runtime / 'server.log').open('ab', buffering=0) as output:
    try:
        process = subprocess.Popen(command, cwd=cwd, stdin=subprocess.DEVNULL,
            stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
        (runtime / 'server-process.json').write_text(json.dumps({'pid': process.pid}))
        code = process.wait()
    except Exception as exc:
        output.write((type(exc).__name__ + ': ' + str(exc) + '\\n').encode())
        code = 127
    (runtime / 'server-exit.json').write_text(json.dumps({'exit_code': code}))
"""


def listening(url):
    parsed = urlsplit(url)
    if parsed.hostname in {'127.0.0.1', 'localhost'}:
        # Docker's published-port proxy can accept TCP before the application
        # starts. Probe the actual service inside Maker instead of that proxy.
        try:
            probe = subprocess.run(['docker', 'exec', 'maker', 'python3', '-c',
                'import socket,sys; socket.create_connection(("127.0.0.1",int(sys.argv[1])),0.5).close()',
                str(parsed.port)], capture_output=True, timeout=5)
            return probe.returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            return False
    try:
        with socket.create_connection((parsed.hostname, parsed.port), timeout=0.25):
            return True
    except OSError:
        return False


def ensure_started(workspace: Path, app: dict, url: str, round_no: int) -> dict | None:
    command = app.get('start_command')
    if not command:
        return None  # Existing app.json contracts remain valid.
    if listening(url):
        return {'state': 'already_listening'}
    runtime = workspace / '.harness/runtime'
    if runtime.is_symlink() or not runtime.resolve().is_relative_to(workspace.resolve()):
        raise ValueError('Runtime directory must remain inside the Maker workspace')
    runtime.mkdir(parents=True, exist_ok=True)
    for name in ('launch.json', 'server.log', 'server-process.json', 'server-exit.json'):
        if (runtime / name).is_symlink():
            raise ValueError('Runtime bookkeeping cannot be a symbolic link')
    record = runtime / 'launch.json'
    # Environment retries in one round must not start several app processes.
    previous = json.loads(record.read_text()) if record.exists() else {}
    if previous.get('round') == round_no:
        return {'state': 'already_attempted_this_round'}
    cwd = app.get('start_cwd', '/work')
    record.write_text(json.dumps({'round': round_no, 'command': command, 'cwd': cwd,
                                 'state': 'launching'}))
    try:
        subprocess.run(['docker', 'exec', '-d', '-w', '/work', harness.MAKER,
                        'python3', '-c', LAUNCH, json.dumps(command), cwd],
                       check=True, capture_output=True, text=True, timeout=30)
    except Exception:
        record.unlink()  # Docker launch itself failed; allow an environment retry.
        raise
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if listening(url):
            return {'state': 'started', 'round': round_no}
        time.sleep(0.25)
    return {'state': 'not_listening_after_start', 'round': round_no}
