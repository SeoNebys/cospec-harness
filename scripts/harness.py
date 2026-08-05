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
import os
import shutil
import stat
import subprocess
from datetime import datetime
from pathlib import Path

import yaml

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
APP_PORT = 3000                                 # published for viewing a running implementation

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


def existing_run_count(cid: str) -> int:
    d = RUNS / cid
    return len([p for p in d.glob("run-*") if p.name.split("-", 1)[1].isdigit()]) if d.exists() else 0


# --------------------------------------------------------------------------- #
# docker
# --------------------------------------------------------------------------- #
def _mount(host: Path, container: str, ro: bool = False) -> list[str]:
    tag = ":ro" if ro else ""
    return ["-v", f"{host.resolve()}:{container}{tag}"]


def _rm_container(name: str) -> None:
    subprocess.run(["docker", "rm", "-f", name],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def auth_env() -> list[str]:
    """Forward whichever auth is set on the host into the container.

    Supports either a Console API key (ANTHROPIC_API_KEY) or a Pro/Max
    subscription token (CLAUDE_CODE_OAUTH_TOKEN, from `claude setup-token`).
    Note: if both are set, ANTHROPIC_API_KEY wins in the CLI's precedence and
    can cause failures — set only one.
    """
    flags: list[str] = []
    for var in ("ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_RETRY_WATCHDOG"):
        if os.environ.get(var):
            flags += ["-e", var]
    has_key = bool(os.environ.get("ANTHROPIC_API_KEY"))
    has_tok = bool(os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"))
    if not (has_key or has_tok):
        print("[harness] WARNING: no ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN set")
    elif has_key and has_tok:
        print("[harness] WARNING: both API key and OAuth token set — API key wins; unset one")
    return flags


def _run_detached(name: str, mounts: list[str], publish: bool = False) -> None:
    cmd = ["docker", "run", "-d", "--name", name] + auth_env()
    if publish:
        cmd += ["-p", f"{APP_PORT}:{APP_PORT}"]
    cmd += mounts + [IMAGE]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)


# --------------------------------------------------------------------------- #
# setup / teardown
# --------------------------------------------------------------------------- #
def setup(cid: str) -> int:
    """Prepare a fresh run for condition `cid`; launch maker + director. Returns run no."""
    spec = condition_spec(cid)
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

    (SESSION / "context.md").write_text(
        f"# Run context\n\n"
        f"- condition: {cid}\n- method: {method}\n- engagement: {engagement}\n- run: {run}\n",
        encoding="utf-8",
    )

    _rm_container(MAKER)
    _rm_container(DIRECTOR)

    # maker: workspace + its own transcript; no oracle -> information asymmetry.
    _run_detached(MAKER,
                  _mount(MAKER_WS, "/work") + _mount(MAKER_TS, "/home/node/.claude/projects"),
                  publish=True)
    # director: policy cwd + oracle(RO) + broker-curated presentation(RO) + transcript.
    _run_detached(DIRECTOR,
                  _mount(DIRECTOR_WS, "/work")
                  + _mount(ORACLE, "/oracle", ro=True)
                  + _mount(PRESENTATION, "/presentation", ro=True)
                  + _mount(DIRECTOR_TS, "/home/node/.claude/projects"))

    if method == "sdd":
        subprocess.run(
            ["docker", "exec", "-w", "/work", MAKER, "sh", "-c",
             "uvx --from git+https://github.com/github/spec-kit.git "
             "specify init --here --integration claude"],
            check=False,
        )
        # Spec Drafter persona LAST, so it wins over any CLAUDE.md specify wrote:
        # `specify init` only installs the skills; this makes the maker USE them
        # (drive the gates) instead of degenerating into vibe coding.
        shutil.copytree(METHOD_CONFIGS / "sdd", MAKER_WS, dirs_exist_ok=True)

    print(f"[setup] {cid} run-{run:02d} ready (method={method}, engagement={engagement})")
    return run


def teardown() -> None:
    """Archive the current run to runs/<ID>/run-NN, remove containers, wipe _work."""
    ctxf = SESSION / "context.md"
    if not ctxf.exists():
        raise SystemExit("[teardown] _work/session/context.md missing — run setup first.")

    ctx = _parse_context(ctxf.read_text(encoding="utf-8"))
    cid, run = ctx.get("condition"), int(ctx.get("run", "0"))
    dst = RUNS / cid / f"run-{run:02d}"
    dst.mkdir(parents=True, exist_ok=True)

    for name, src in [("maker-workspace", MAKER_WS), ("maker-transcript", MAKER_TS),
                      ("director-transcript", DIRECTOR_TS), ("presentation", PRESENTATION),
                      ("session", SESSION)]:
        if src.exists():
            shutil.copytree(src, dst / name, dirs_exist_ok=True, ignore=ARCHIVE_IGNORE)

    broker_log = SESSION / "broker-log.json"
    if broker_log.exists():
        shutil.copy2(broker_log, dst / "broker-log.json")

    (dst / "meta.json").write_text(
        json.dumps({
            "condition": cid, "method": ctx.get("method"),
            "engagement": ctx.get("engagement"), "run": run,
            "archived_at": datetime.now().isoformat(timespec="seconds"),
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"[teardown] archived: {dst}")

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
