#!/usr/bin/env python3
"""Broker — the batch runner and in-session relay.

The broker is deliberately NON-AGENTIC: it passes the director's utterance to
the maker verbatim (raw == relayed), never composing or interpreting reaction
content. Its jobs are (1) expand the run-plan into an ordered schedule,
(2) per run: setup -> session loop -> teardown, (3) curate the presentation
surface the director may see, (4) log every utterance.

Usage:
  python scripts/broker.py                 # run per config/run-plan.yaml
  python scripts/broker.py CO-D            # single ad-hoc run of one condition
  python scripts/broker.py CO-D --trials 3 # run one condition N times
  python scripts/broker.py --max-rounds 20 # override the safety cap

Auth/model: containers read ANTHROPIC_API_KEY from the environment. Set
HARNESS_MODEL to pin a specific model (recommended for reproducibility).
"""
from __future__ import annotations

import argparse
import json
import os
import random
import subprocess
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

import yaml

import harness
from render_preview import render_html

# Windows consoles default to cp949; force UTF-8 so progress prints never crash
# on non-ASCII (em-dash, Korean, etc.).
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

CALL_TIMEOUT = int(os.environ.get("HARNESS_CALL_TIMEOUT", "1800"))
MODEL = os.environ.get("HARNESS_MODEL")
# Method-agnostic terminator: if the maker's workspace produces nothing new for
# this many consecutive rounds (the client is no longer driving changes), the
# session has settled. Handles VC/SDD, which lack COSPEC's phase state machine.
STALL_ROUNDS = int(os.environ.get("HARNESS_STALL_ROUNDS", "3"))

# Usage/rate-limit handling: on a subscription (or a tier cap) a call can fail
# with a limit error. We detect it broadly, wait, and retry the SAME session_id
# (the container stays alive and the transcript persists, so the session resumes
# exactly where it stopped). Poll interval and total cap are tunable via env.
LIMIT_MARKERS = ("usage limit", "session limit", "rate limit", "rate_limit",
                 "resets", "429", "too many requests", "quota", "overloaded", "529")
LIMIT_WAIT = int(os.environ.get("HARNESS_LIMIT_WAIT", "900"))        # 15 min between retries
LIMIT_MAX_WAIT = int(os.environ.get("HARNESS_LIMIT_MAX_WAIT", "86400"))  # give up after 24h


# --------------------------------------------------------------------------- #
# agent invocation (headless claude -p over docker exec)
# --------------------------------------------------------------------------- #
def _is_limit(err: str) -> bool:
    e = err.lower()
    return any(m in e for m in LIMIT_MARKERS)


def _claude(container: str, prompt: str, session_id: str | None) -> dict:
    cmd = ["docker", "exec", "-w", "/work", container, "claude", "-p", prompt,
           "--output-format", "json", "--dangerously-skip-permissions"]
    if session_id:
        cmd += ["--resume", session_id]
    if MODEL:
        cmd += ["--model", MODEL]

    waited = 0
    while True:
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                              timeout=CALL_TIMEOUT)
        if proc.returncode == 0:
            try:
                return json.loads(proc.stdout)
            except json.JSONDecodeError:
                raise RuntimeError(f"{container}: non-JSON output\n{proc.stdout[:800]}")
        err = (proc.stderr or "") + (proc.stdout or "")
        # Usage/rate limit -> wait and retry the same session (resumes in place).
        if _is_limit(err) and waited < LIMIT_MAX_WAIT:
            waited += LIMIT_WAIT
            print(f"[broker] limit hit ({container}); waiting {LIMIT_WAIT}s then resuming "
                  f"(waited {waited}s / cap {LIMIT_MAX_WAIT}s)\n    {err.strip()[:200]}")
            time.sleep(LIMIT_WAIT)
            continue
        raise RuntimeError(f"{container}: claude -p exited {proc.returncode}\n{proc.stderr[:800]}")


def _text(resp: dict) -> str:
    return (resp.get("result") or "").strip()


def _usage(resp: dict) -> dict:
    return resp.get("usage", {}) or {}


# --------------------------------------------------------------------------- #
# presentation curation — what the director (the client) is allowed to see
# --------------------------------------------------------------------------- #
def curate(method: str, round_no: int) -> list[str]:
    """Copy the maker's *presented* artifacts into _work/presentation/round-NN.

    Method-specific, mirroring each method's interaction model:
      cospec -> prototype UI only (HTML + rendered PNG). NEVER context/ (scenarios,
                Gherkin) or .claude/ — COSPEC does not expose the spec to the client.
      sdd    -> the spec documents presented at the gate (specs/**/*.md).
      vibe   -> the running app, rendered to PNG.
    Returns container-relative paths (/presentation/...) for the director prompt.
    """
    dest = harness.PRESENTATION / f"round-{round_no:02d}"
    dest.mkdir(parents=True, exist_ok=True)
    ws = harness.MAKER_WS
    refs: list[str] = []

    def _take_html(html: Path) -> None:
        out = dest / html.name
        out.write_text(html.read_text(encoding="utf-8", errors="replace"), encoding="utf-8")
        refs.append(f"/presentation/round-{round_no:02d}/{out.name}")
        png = dest / (html.stem + ".png")
        if render_html(html, png):
            refs.append(f"/presentation/round-{round_no:02d}/{png.name}")

    if method == "cospec":
        proto = ws / "prototypes"
        if proto.exists():
            for html in sorted(proto.rglob("*.html")):
                _take_html(html)
    elif method == "sdd":
        specs = ws / "specs"
        if specs.exists():
            for md in sorted(specs.rglob("*.md")):
                rel = md.relative_to(specs)
                out = dest / str(rel).replace(os.sep, "__")
                out.write_text(md.read_text(encoding="utf-8", errors="replace"), encoding="utf-8")
                refs.append(f"/presentation/round-{round_no:02d}/{out.name}")
    else:  # vibe
        for html in sorted(ws.glob("*.html")) + sorted(ws.glob("**/index.html")):
            _take_html(html)
            break  # the app entry point is enough

    return refs


def director_prompt(maker_text: str, refs: list[str], round_no: int) -> str:
    listing = "\n".join(f"  - {r}" for r in refs) or "  (no artifacts presented this round)"
    return (
        f"# Round {round_no}\n\n"
        "The maker (who cannot see the reference spec) just said:\n"
        f"<<<MAKER\n{maker_text}\nMAKER\n\n"
        "Artifacts the maker presented this round (read them if useful):\n"
        f"{listing}\n\n"
        "Your ground truth is /oracle/reference-spec.md. Follow the engagement "
        "policy in ./CLAUDE.md.\n\n"
        "Reply with ONLY the client's next utterance — the natural-language message "
        "the client says back to the maker. Do not describe your reasoning."
    )


def _maker_converged() -> bool:
    """Convergence is owned by the maker's cycle, not the director: the session
    ends when the maker has delivered an implementation and marked its own cycle
    complete (Phase 4 accepted / idle). Detected from the maker's workspace —
    never from a client declaration. Requires implementation/ to exist, so the
    run cannot 'converge' on prototypes alone."""
    ws = harness.MAKER_WS
    if not (ws / "implementation").exists():
        return False
    claude_md = ws / "CLAUDE.md"
    if not claude_md.exists():
        return False
    done = ("idle", "waiting", "complete", "done", "accepted", "완료", "대기")
    for line in claude_md.read_text(encoding="utf-8", errors="replace").splitlines():
        low = line.lower()
        if "current phase" in low and any(k in low for k in done):
            return True
    return False


def _workspace_sig() -> tuple:
    """Signature of the maker's produced files (path+size), for stall detection.
    Method-agnostic: unchanged across rounds means the maker is producing nothing
    new because the client is no longer driving change.

    Uses os.walk with directory pruning so node_modules/.git are never traversed
    (their .bin junctions raise WinError 1920 on Windows if walked/stat'd)."""
    ws = str(harness.MAKER_WS)
    skip = {"node_modules", ".git"}
    out = []
    for root, dirs, files in os.walk(ws):
        dirs[:] = [d for d in dirs if d not in skip]
        for f in files:
            fp = os.path.join(root, f)
            try:
                out.append((os.path.relpath(fp, ws), os.path.getsize(fp)))
            except OSError:
                pass
    return tuple(sorted(out))


# --------------------------------------------------------------------------- #
# session loop
# --------------------------------------------------------------------------- #
def _summarize(log: list[dict], cid: str, run_no: int, t0: datetime, t1: datetime,
               term: str | None, max_rounds: int) -> dict:
    """Per-condition consumption summary. Tokens are the reliable quota-burn proxy
    (additive, per-call); cost_usd is summed best-effort. Remaining subscription
    quota is NOT queryable headless — map these timestamps to your observed %."""
    def tok(role: str, k: str) -> int:
        return sum((e.get("usage") or {}).get(k, 0) for e in log if e.get("role") == role)

    def cost(role: str) -> float:
        return round(sum((e.get("cost_usd") or 0.0) for e in log if e.get("role") == role), 4)

    def block(role: str) -> dict:
        return {"output_tokens": tok(role, "output_tokens"),
                "input_tokens": tok(role, "input_tokens"),
                "cache_read_tokens": tok(role, "cache_read_input_tokens"),
                "cache_creation_tokens": tok(role, "cache_creation_input_tokens"),
                "cost_usd_sum": cost(role)}

    rounds = max((e["round"] for e in log), default=0)
    return {
        "condition": cid, "run": run_no, "rounds": rounds,
        "terminated": term, "hit_max_rounds": term is None and rounds >= max_rounds,
        "started_at": t0.isoformat(timespec="seconds"),
        "ended_at": t1.isoformat(timespec="seconds"),
        "wall_seconds": int((t1 - t0).total_seconds()),
        "maker": block("maker"), "client": block("client"),
        "total_output_tokens": tok("maker", "output_tokens") + tok("client", "output_tokens"),
        "total_cost_usd_sum": round(cost("maker") + cost("client"), 4),
    }


def run_session(cid: str, method: str, run_no: int, max_rounds: int) -> dict:
    log: list[dict] = []
    log_path = harness.SESSION / "broker-log.json"

    def _persist() -> None:
        log_path.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")

    t0 = datetime.now()
    initial = harness.initial_prompt()
    log.append({"round": 0, "role": "system", "content": initial, "chars": len(initial)})
    _persist()

    msid = dsid = None
    prompt_to_maker = initial
    term = None
    last_sig, unchanged = None, 0

    for rnd in range(1, max_rounds + 1):
        m = _claude(harness.MAKER, prompt_to_maker, msid)
        msid = m.get("session_id")
        maker_text = _text(m)
        refs = curate(method, rnd)
        log.append({"round": rnd, "role": "maker", "content": maker_text,
                    "chars": len(maker_text), "usage": _usage(m),
                    "cost_usd": m.get("total_cost_usd"),
                    "session_id": msid, "artifacts": refs})
        _persist()

        # Termination is owned by the process, not a client declaration:
        #  - COSPEC: maker cycle reaches acceptance/idle (phase-state signal)
        #  - any method: workspace produces nothing new for STALL_ROUNDS rounds
        sig = _workspace_sig()
        unchanged = unchanged + 1 if sig == last_sig else 0
        last_sig = sig
        if _maker_converged():
            term = "converged"
            print(f"    round {rnd}: maker {len(maker_text)}c  [converged]")
            break
        if unchanged >= STALL_ROUNDS:
            term = "settled"
            print(f"    round {rnd}: maker {len(maker_text)}c  [settled - no new output x{STALL_ROUNDS}]")
            break

        d = _claude(harness.DIRECTOR, director_prompt(maker_text, refs, rnd), dsid)
        dsid = d.get("session_id")
        client_text = _text(d)              # relayed verbatim (no client-side stop signal)
        log.append({"round": rnd, "role": "client", "content": client_text,
                    "relayed": client_text, "chars": len(client_text), "usage": _usage(d),
                    "cost_usd": d.get("total_cost_usd"), "session_id": dsid})
        _persist()

        print(f"    round {rnd}: maker {len(maker_text)}c -> client {len(client_text)}c")
        prompt_to_maker = client_text       # verbatim relay
    else:
        print(f"    reached max_rounds={max_rounds} without convergence (capped — invalid run)")

    _persist()
    summary = _summarize(log, cid, run_no, t0, datetime.now(), term, max_rounds)
    (harness.SESSION / "usage-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    harness.RUNS.mkdir(parents=True, exist_ok=True)
    with (harness.RUNS / "usage-ledger.jsonl").open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(summary, ensure_ascii=False) + "\n")
    print(f"    consumed: {summary['total_output_tokens']} out-tokens, "
          f"{summary['wall_seconds']}s, {summary['rounds']} rounds"
          + (f", ${summary['total_cost_usd_sum']}" if summary['total_cost_usd_sum'] else ""))
    return summary


# --------------------------------------------------------------------------- #
# run-plan expansion
# --------------------------------------------------------------------------- #
def expand_plan(plan: dict) -> list[str]:
    order = plan.get("order", "interleaved")
    if order == "sequence":
        seq = list(plan["sequence"])
    elif order == "blocked":
        seq = [c for c in plan["conditions"] for _ in range(plan["repeat"])]
    else:  # interleaved
        seq = [c for _ in range(plan["repeat"]) for c in plan["conditions"]]

    if plan.get("resume"):
        skip = {c: harness.existing_run_count(c) for c in Counter(seq)}
        remaining = []
        for c in seq:
            if skip.get(c, 0) > 0:
                skip[c] -= 1
                continue
            remaining.append(c)
        seq = remaining

    if plan.get("shuffle"):
        random.Random(plan.get("seed", 0)).shuffle(seq)
    return seq


def _teardown_safe() -> None:
    if (harness.SESSION / "context.md").exists():
        harness.teardown()


def run_one(cid: str, max_rounds: int) -> None:
    method = harness.condition_spec(cid)["method"]
    try:
        run_no = harness.setup(cid)
        print(f"  == {cid} run-{run_no:02d} ==")
        run_session(cid, method, run_no, max_rounds)
    finally:
        _teardown_safe()


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cid", nargs="?", help="run a single condition ad-hoc (else use run-plan.yaml)")
    ap.add_argument("--trials", type=int, help="repeat count for the single-condition mode")
    ap.add_argument("--max-rounds", type=int, help="override run-plan max_rounds")
    args = ap.parse_args()

    plan = yaml.safe_load((harness.CONFIG / "run-plan.yaml").read_text(encoding="utf-8"))["run_plan"]
    max_rounds = args.max_rounds or plan.get("max_rounds", 40)
    keep_going = plan.get("keep_going", True)

    if args.cid:
        seq = [args.cid] * (args.trials or 1)
    else:
        seq = expand_plan(plan)

    if not seq:
        print("[broker] nothing to run (resume: all targets already met?)")
        return

    print(f"[broker] schedule ({len(seq)} runs): {', '.join(seq)}")
    for i, cid in enumerate(seq, 1):
        print(f"[broker] {i}/{len(seq)} -> {cid}")
        try:
            run_one(cid, max_rounds)
        except Exception as e:            # noqa: BLE001 - batch resilience
            print(f"[broker] run failed ({cid}): {e}")
            if not keep_going:
                raise
    print("[broker] batch complete")


if __name__ == "__main__":
    main()
