#!/usr/bin/env python3
"""Shared harness primitives: paths, container lifecycle, setup(), teardown().

These are imported by broker.py (the batch runner) and re-exported by the
setup.py / teardown.py CLI wrappers for manual single runs.

Role model:
  maker    - LLM agent that builds the software. Configured by a method seed
             (method-configs/<method>/). Never sees the reference spec.
  director - LLM agent that plays the reference-anchored client. Configured by
             director-configs/<engagement>/. Mounts oracle/ read-only.
  judge    - blind evaluator, run post-hoc (see judge.py), not launched here.
  broker   - this program; a mechanical relay, never an agent (see broker.py).
"""
from __future__ import annotations

import json
import ipaddress
import os
import shutil
import stat
import subprocess
import uuid
from datetime import datetime
from pathlib import Path

import yaml
import llm
from subscription_auth import AuthError, AuthStore

ROOT = Path(__file__).resolve().parent.parent          # research/data/cospec-harness
WORK = ROOT / "_work"

# Runtime working directories (gitignored; archived by teardown, then wiped).
MAKER_WS = WORK / "maker-workspace"
MAKER_TS = WORK / "maker-transcript"
DIRECTOR_WS = WORK / "director-workspace"
DIRECTOR_TS = WORK / "director-transcript"
PRESENTATION = WORK / "presentation"          # broker-curated surface shown to director
SESSION = WORK / "session"                    # run bookkeeping (context.md)

# Repo-controlled sources.
CONFIG = ROOT / "config"
ORACLE = ROOT / "oracle"                       # ground truth; RO into director/judge only
METHOD_CONFIGS = ROOT / "method-configs"
DIRECTOR_CONFIGS = ROOT / "director-configs"
RUNS = ROOT / "runs"

IMAGE = "cospec-harness-env"                    # docker build -t <IMAGE> docker/
MAKER = "maker"
DIRECTOR = "director"
APP_PORT = 4000
PROTOTYPE_PORT = 4001
NETWORK = 'cospec-experiment'

# Archiving: node_modules is bulky/regenerable and its npm workspace junctions
# break copytree on Windows (WinError 1920); package.json/lock suffice to reproduce.
# Skip bulky/regenerable trees and OS junctions that break copytree on Windows
# (node_modules/.bin, .venv/lib64 are junctions -> WinError 1920).
ARCHIVE_IGNORE = shutil.ignore_patterns("node_modules", ".git", ".venv", "__pycache__")


# --------------------------------------------------------------------------- #
# .env (gitignored) — auto-loaded so tokens/keys need not be exported each shell.
# Real shell environment always wins over the file.
# --------------------------------------------------------------------------- #
def _load_dotenv() -> None:
    envf = ROOT / ".env"
    if not envf.exists():
        return
    for line in envf.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


_load_dotenv()


# --------------------------------------------------------------------------- #
# config
# --------------------------------------------------------------------------- #
def load_conditions() -> dict:
    return yaml.safe_load((CONFIG / "conditions.yaml").read_text(encoding="utf-8"))["conditions"]


def condition_spec(cid: str) -> dict:
    conds = load_conditions()
    if cid not in conds:
        raise SystemExit(f"[harness] unknown condition: {cid} (known: {', '.join(conds)})")
    return conds[cid]


def initial_prompt() -> str:
    return (CONFIG / "initial-prompt.txt").read_text(encoding="utf-8").strip()


# --------------------------------------------------------------------------- #
# filesystem helpers
# --------------------------------------------------------------------------- #
def _reset(path: Path) -> None:
    if path.exists():
        _rmtree_robust(path)
    path.mkdir(parents=True)


def _on_rm_error(func, path, exc):
    """Windows read-only (.git pack files etc.): grant write, retry."""
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass


def _rmtree_robust(p: Path) -> None:
    try:
        shutil.rmtree(p, onexc=_on_rm_error)          # py>=3.12
    except TypeError:
        shutil.rmtree(p, onerror=_on_rm_error)         # py<3.12


def next_run(cid: str) -> int:
    d = RUNS / cid
    nums = []
    if d.exists():
        for p in d.glob("run-*"):
            tail = p.name.split("-", 1)[1]
            if tail.isdigit():
                nums.append(int(tail))
    return max(nums, default=0) + 1


def existing_run_count(cid: str, models: dict | None = None) -> int:
    d = RUNS / cid
    count = 0
    for p in d.glob("run-*"):
        if not p.name.split("-", 1)[1].isdigit():
            continue
        if models is not None:
            meta = p / "meta.json"
            summary = p / "session/usage-summary.json"
            if not meta.exists() or not summary.exists():
                continue
            if json.loads(meta.read_text()).get("models") != models:
                continue
            if json.loads(summary.read_text()).get("terminated") not in {'converged', 'settled', 'accepted'}:
                continue
        count += 1
    return count


# --------------------------------------------------------------------------- #
# docker
# --------------------------------------------------------------------------- #
def _mount(host: Path, container: str, ro: bool = False) -> list[str]:
    tag = ":ro" if ro else ""
    return ["-v", f"{host.resolve()}:{container}{tag}"]


def _rm_container(name: str) -> None:
    subprocess.run(["docker", "rm", "-f", name],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def auth_env(provider: str = "claude", role: str = MAKER) -> list[str]:
    """Container auth flags. VM subscription files are the default.

    HARNESS_AUTH_MODE=env explicitly retains the previous Claude token/key mode.
    Provider-specific model invocation is configured separately from auth.
    """
    mode = os.environ.get("HARNESS_AUTH_MODE", "subscription")
    if mode == "subscription":
        store = AuthStore(provider, role)
        flags = store.container_args()
        return flags
    if mode != "env" or provider != "claude":
        raise AuthError("HARNESS_AUTH_MODE must be subscription, or env for Claude")
    flags: list[str] = []
    for var in ("ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_RETRY_WATCHDOG"):
        if os.environ.get(var):
            flags += ["-e", var]
    has_key = bool(os.environ.get("ANTHROPIC_API_KEY"))
    has_tok = bool(os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"))
    if not (has_key or has_tok):
        raise AuthError("env auth requires ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN")
    elif has_key and has_tok:
        raise AuthError("Set only one of ANTHROPIC_API_KEY and CLAUDE_CODE_OAUTH_TOKEN")
    return flags


def run_llm(provider: str, role: str, cmd: list[str], **kwargs):
    """Serialize each provider's calls and preserve any CLI credential refresh."""
    mode = os.environ.get("HARNESS_AUTH_MODE", "subscription")
    if mode == "subscription":
        return AuthStore(provider, role).run(cmd, **kwargs)
    if mode != "env" or provider != "claude":
        raise AuthError("Unsupported authentication mode/provider")
    return subprocess.run(cmd, **kwargs)


def _run_detached(name: str, mounts: list[str], publish: bool = False,
                  provider: str = "claude") -> None:
    cmd = ["docker", "run", "-d", "--name", name, '--init', '--shm-size=256m'] + auth_env(provider, name)
    if name in {MAKER, DIRECTOR}:
        ensure_network()
        cmd += ['--network', NETWORK]
    if publish:
        for port in (APP_PORT, PROTOTYPE_PORT):
            cmd += ['-p', f'127.0.0.1:{port}:{port}']
    cmd += mounts + [IMAGE]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)


def ensure_network() -> None:
    probe = subprocess.run(['docker', 'network', 'inspect', NETWORK], capture_output=True)
    if probe.returncode:
        subprocess.run(['docker', 'network', 'create', NETWORK], check=True,
                       stdout=subprocess.DEVNULL)


def policy_filename(provider: str) -> str:
    return {"claude": "CLAUDE.md", "codex": "AGENTS.md"}[provider]


def adapt_policy(workspace: Path, provider: str) -> None:
    """Change only the runtime entry filename and the installed Spec Kit path."""
    source = workspace / "CLAUDE.md"
    if provider == "claude" or not source.exists():
        return
    content = source.read_text(encoding="utf-8")
    if provider == "codex":
        content = content.replace(".claude/skills/", ".agents/skills/")
    (workspace / policy_filename(provider)).write_text(content, encoding="utf-8")
    source.unlink()


def transcript_mount(path: Path, provider: str) -> list[str]:
    target = {"claude": "/home/node/.claude/projects", "codex": "/home/node/.codex/sessions"}[provider]
    return _mount(path, target)


def maker_http_url(port: int, path: str) -> str:
    """Host capture route; old archived sessions retain bridge-IP compatibility."""
    if (MAKER_WS / '.harness/runtime-contract.json').exists():
        if port not in (APP_PORT, PROTOTYPE_PORT):
            raise ValueError('Unsupported presentation port')
        return f'http://127.0.0.1:{port}{path}'
    raw = subprocess.check_output([
        "docker", "inspect", MAKER, "--format",
        '{{(index .NetworkSettings.Networks "bridge").IPAddress}}'], text=True).strip()
    address = ipaddress.IPv4Address(raw)
    return f"http://{address}:{port}{path}"


def director_http_url(port: int, path: str) -> str:
    return f'http://{MAKER}:{port}{path}'


def check_director_route(port: int) -> None:
    """Check DNS/TCP from the actual Director without replaying a stateful URL."""
    subprocess.run(['docker', 'exec', DIRECTOR, 'python3', '-c',
                    'import socket,sys; socket.create_connection((sys.argv[1],int(sys.argv[2])),5).close()',
                    MAKER, str(port)], check=True, capture_output=True, timeout=10)


def install_runtime_policy(workspace: Path) -> None:
    """Apply the same operational presentation contract to every Maker method."""
    policy = workspace / "CLAUDE.md"
    existing = policy.read_text(encoding="utf-8") if policy.exists() else ""
    runtime = (CONFIG / "runtime-presentation.md").read_text(encoding="utf-8")
    policy.write_text(existing.rstrip() + "\n\n" + runtime, encoding="utf-8")


# --------------------------------------------------------------------------- #
# setup / teardown
# --------------------------------------------------------------------------- #
def setup(cid: str, maker: llm.Model | None = None, director: llm.Model | None = None,
          trial: dict | None = None) -> int:
    """Prepare a fresh run for condition `cid`; launch maker + director. Returns run no."""
    if (SESSION / "presentation-checkpoint.json").exists():
        raise RuntimeError("A presentation is pending; use broker.py --resume-session before starting another run")
    spec = condition_spec(cid)
    maker = maker or llm.select("maker")
    director = director or llm.select("director")
    method, engagement = spec["method"], spec["engagement"]
    run = next_run(cid)

    for d in (MAKER_WS, MAKER_TS, DIRECTOR_WS, DIRECTOR_TS, PRESENTATION, SESSION):
        _reset(d)

    # maker workspace seeding (oracle is NEVER copied/mounted into the maker)
    if method == "cospec":
        shutil.copytree(METHOD_CONFIGS / "cospec", MAKER_WS, dirs_exist_ok=True)
    # vibe -> empty; sdd -> `specify init` after the container is up (below)

    # director workspace seeding (its cwd holds the engagement policy CLAUDE.md)
    shutil.copytree(DIRECTOR_CONFIGS / engagement, DIRECTOR_WS, dirs_exist_ok=True)
    adapt_policy(DIRECTOR_WS, director.provider)

    (SESSION / "context.md").write_text(
        f"# Run context\n\n"
        f"- condition: {cid}\n- method: {method}\n- engagement: {engagement}\n- run: {run}\n",
        encoding="utf-8",
    )
    (SESSION / "models.json").write_text(json.dumps({"maker": maker.metadata(),
                                                     "director": director.metadata()}, indent=2))
    if trial is not None:
        (SESSION / "trial.json").write_text(json.dumps(trial, indent=2) + "\n")
    (SESSION / 'control.json').write_text(json.dumps({
        'termination': 'director_tag', 'interruption': 'stop'}))
    image_id = subprocess.check_output(["docker", "image", "inspect", IMAGE,
                                        "--format", "{{.Id}}"], text=True).strip()
    (SESSION / "image-id.txt").write_text(image_id + "\n")

    _rm_container(MAKER)
    _rm_container(DIRECTOR)

    # maker: workspace + its own transcript; no oracle -> information asymmetry.
    _run_detached(MAKER,
                  _mount(MAKER_WS, "/work") + transcript_mount(MAKER_TS, maker.provider),
                  publish=True, provider=maker.provider)
    # director: policy cwd + oracle(RO) + broker-curated presentation(RO) + transcript.
    _run_detached(DIRECTOR,
                  _mount(DIRECTOR_WS, "/work")
                  + _mount(ORACLE, "/oracle", ro=True)
                  + _mount(PRESENTATION, "/presentation", ro=True)
                  + transcript_mount(DIRECTOR_TS, director.provider), provider=director.provider)

    if method == "sdd":
        subprocess.run(
            ["docker", "exec", "-w", "/work", MAKER,
             "specify", "init", "--here", "--integration", maker.provider, "--script", "sh"],
            check=True,
        )
        # Spec Drafter persona LAST, so it wins over any CLAUDE.md specify wrote:
        # `specify init` only installs the skills; this makes the maker USE them
        # (drive the gates) instead of degenerating into vibe coding.
        shutil.copytree(METHOD_CONFIGS / "sdd", MAKER_WS, dirs_exist_ok=True)

    (MAKER_WS / '.harness').mkdir(exist_ok=True)
    (MAKER_WS / '.harness/runtime-contract.json').write_text(json.dumps({
        'application_port': APP_PORT, 'prototype_port': PROTOTYPE_PORT,
        'network': NETWORK}))
    install_runtime_policy(MAKER_WS)
    adapt_policy(MAKER_WS, maker.provider)

    print(f"[setup] {cid} run-{run:02d} ready (method={method}, engagement={engagement})")
    return run


def archive_current_run() -> Path:
    """Archive without cleaning up; preserve links instead of following them."""
    if (SESSION / "presentation-checkpoint.json").exists():
        raise RuntimeError("A presentation is pending; preserve its containers and workspace for resume")
    ctxf = SESSION / "context.md"
    if not ctxf.exists():
        raise SystemExit("[teardown] _work/session/context.md missing — run setup first.")

    ctx = _parse_context(ctxf.read_text(encoding="utf-8"))
    cid, run = ctx.get("condition"), int(ctx.get("run", "0"))
    final = RUNS / cid / f"run-{run:02d}"
    final.parent.mkdir(parents=True, exist_ok=True)
    if (final / "archive-complete.json").exists():
        raise RuntimeError(f"Completed archive already exists: {final}")
    dst = final.with_name(f".{final.name}.archiving-{uuid.uuid4().hex}")
    dst.mkdir()

    for name, src in [("maker-workspace", MAKER_WS), ("maker-transcript", MAKER_TS),
                      ("director-workspace", DIRECTOR_WS),
                      ("director-transcript", DIRECTOR_TS), ("presentation", PRESENTATION),
                      ("session", SESSION)]:
        if src.exists():
            shutil.copytree(src, dst / name, symlinks=True, ignore=ARCHIVE_IGNORE)

    broker_log = SESSION / "broker-log.json"
    if broker_log.exists():
        shutil.copy2(broker_log, dst / "broker-log.json")

    (dst / "meta.json").write_text(
        json.dumps({
            "condition": cid, "method": ctx.get("method"),
            "engagement": ctx.get("engagement"), "run": run,
            "trial": json.loads((SESSION / "trial.json").read_text()) if (SESSION / "trial.json").exists() else None,
            "models": json.loads((SESSION / "models.json").read_text()) if (SESSION / "models.json").exists() else None,
            "image_id": (SESSION / "image-id.txt").read_text().strip() if (SESSION / "image-id.txt").exists() else None,
            "archived_at": datetime.now().isoformat(timespec="seconds"),
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (dst / "archive-complete.json").write_text(json.dumps({
        "condition": cid, "run": run, "completed_at": datetime.now().isoformat(),
        "symlinks": "preserved without dereferencing",
    }, indent=2) + "\n")
    # Keep an earlier partial archive as evidence; never merge stale files into
    # a fresh archive or expose a partly copied directory as a completed run.
    if final.exists():
        final.rename(final.with_name(f".{final.name}.partial-{uuid.uuid4().hex}"))
    dst.rename(final)
    print(f"[archive] archived: {final}")
    return final


def teardown() -> None:
    """Archive completely before removing containers and wiping _work."""
    archive_current_run()

    _rm_container(MAKER)
    _rm_container(DIRECTOR)

    for d in (MAKER_WS, MAKER_TS, DIRECTOR_WS, DIRECTOR_TS, PRESENTATION, SESSION):
        if d.exists():
            _rmtree_robust(d)
        d.mkdir(parents=True)
    print("[teardown] _work reset")


def _parse_context(text: str) -> dict:
    ctx = {}
    for line in text.splitlines():
        line = line.strip().lstrip("-").strip()
        if ":" in line:
            k, v = line.split(":", 1)
            ctx[k.strip()] = v.strip()
    return ctx
