#!/usr/bin/env python3
"""Blind judge — post-hoc coverage scoring, run separately from the live loop.

The judge sees ONLY the final implementation code (mounted read-only) and the
reference spec + rubric. It does not see the condition, the transcript, or who
produced the code — preventing the party that steered the reaction from also
scoring the result.

Usage:
  python scripts/judge.py runs/CO-D/run-01
  python scripts/judge.py runs/CO-D/run-01 --mode co-construction   # see note below

Writes <run>/judgment.json.

Coverage mode judges each REF-BM-### as present/partial/absent from the code.
Co-construction (N_g) mode reads the (condition-stripped) broker-log and counts
mismatch captures per the co-construction rubric; it is a distinct pass because
it needs the interaction record rather than the code.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

import harness

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

JUDGE = "judge"
JUDGE_CONFIGS = harness.ROOT / "judge-configs"
MODEL = os.environ.get("HARNESS_MODEL")

# Same usage/rate-limit handling as broker: wait out the limit and retry, so a
# judge batch survives a depleted subscription quota.
LIMIT_MARKERS = ("usage limit", "session limit", "rate limit", "rate_limit",
                 "resets", "429", "too many requests", "quota", "overloaded", "529")
LIMIT_WAIT = int(os.environ.get("HARNESS_LIMIT_WAIT", "900"))
LIMIT_MAX_WAIT = int(os.environ.get("HARNESS_LIMIT_MAX_WAIT", "86400"))

COVERAGE_SCHEMA = (
    '{"core": {"REF-BM-01": "present|partial|absent", ...}, '
    '"extended": {"REF-BM-23": "...", ...}, '
    '"notes": "brief justification per non-present item"}'
)

NG_SCHEMA = (
    '{"decisions": [{"ref_items": ["REF-BM-06"], "diverged": true, '
    '"caught": true, "catch_type": "negate|correct|extend|select|none", '
    '"note": "one line"}], "n_g": <count of caught divergences>, '
    '"satisficing_misses": <count of diverged-but-not-caught>}'
)


def _run_judge_container(artifacts: Path) -> None:
    subprocess.run(["docker", "rm", "-f", JUDGE],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    cmd = ["docker", "run", "-d", "--name", JUDGE] + harness.auth_env() + [
           "-v", f"{JUDGE_CONFIGS.resolve()}:/work",
           "-v", f"{artifacts.resolve()}:/artifacts:ro",
           "-v", f"{harness.ORACLE.resolve()}:/oracle:ro",
           harness.IMAGE]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)


def _ask(prompt: str) -> str:
    """Run the judge's claude -p. A heartbeat keeps stdout active (so a background
    task watchdog doesn't treat the silent multi-minute call as stalled and retry
    it -> double execution). On a usage/rate limit, wait and retry."""
    cmd = ["docker", "exec", "-w", "/work", JUDGE, "claude", "-p", prompt,
           "--output-format", "json", "--dangerously-skip-permissions"]
    if MODEL:
        cmd += ["--model", MODEL]
    waited = 0
    while True:
        stop = threading.Event()

        def _beat() -> None:
            n = 0
            while not stop.wait(30):
                n += 1
                print(f"    ...judging ({n * 30}s)", flush=True)

        th = threading.Thread(target=_beat, daemon=True)
        th.start()
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True,
                                  encoding="utf-8", timeout=1800)
        finally:
            stop.set()
            th.join(timeout=1)

        if proc.returncode == 0:
            return (json.loads(proc.stdout).get("result") or "").strip()
        err = ((proc.stderr or "") + (proc.stdout or "")).lower()
        if any(m in err for m in LIMIT_MARKERS) and waited < LIMIT_MAX_WAIT:
            waited += LIMIT_WAIT
            print(f"    [judge] limit hit; waiting {LIMIT_WAIT}s then retry "
                  f"(waited {waited}s)", flush=True)
            time.sleep(LIMIT_WAIT)
            continue
        raise RuntimeError(f"judge claude -p exited {proc.returncode}: {proc.stderr[:400]}")


def coverage(run: Path) -> dict:
    artifacts = run / "maker-workspace"
    if not artifacts.exists():
        raise SystemExit(f"[judge] no maker-workspace under {run}")
    _run_judge_container(artifacts)
    try:
        prompt = (
            "Judge coverage of the implementation under /artifacts against the "
            "functional requirements in /oracle/reference-spec.md, following "
            "/oracle/rubrics/coverage.md. You do not know which method produced it. "
            "For every REF-BM-### mark present/partial/absent from the CODE ONLY. "
            f"Return a single JSON object of the form: {COVERAGE_SCHEMA}"
        )
        raw = _ask(prompt)
    finally:
        subprocess.run(["docker", "rm", "-f", JUDGE],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        start, end = raw.index("{"), raw.rindex("}") + 1
        return json.loads(raw[start:end])
    except (ValueError, json.JSONDecodeError):
        return {"raw": raw, "parse_error": True}


def co_construction(run: Path) -> dict:
    """Count co-constructed decisions (N_g) from the transcript, per the rubric.

    Distinct from coverage: needs the interaction record, not the code. Mounts
    ONLY the broker-log (not meta/context, which name the condition) + oracle, in
    a clean empty cwd, so the judge stays blind to the condition."""
    log = run / "broker-log.json"
    if not log.exists():
        log = run / "session" / "broker-log.json"
    if not log.exists():
        raise SystemExit(f"[judge] no broker-log under {run}")

    workdir = Path(tempfile.mkdtemp(prefix="ng-judge-"))
    subprocess.run(["docker", "rm", "-f", JUDGE],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    cmd = ["docker", "run", "-d", "--name", JUDGE] + harness.auth_env() + [
           "-v", f"{workdir.resolve()}:/work",
           "-v", f"{log.resolve()}:/transcript/broker-log.json:ro",
           "-v", f"{harness.ORACLE.resolve()}:/oracle:ro",
           harness.IMAGE]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)
    try:
        prompt = (
            "You are a blind co-construction judge; you do not know which method produced "
            "this session. Read the transcript at /transcript/broker-log.json — role 'maker' "
            "entries are the builder's presentations, role 'client' entries are the requester's "
            "reactions. Follow /oracle/rubrics/co-construction.md, anchoring 'divergence' to "
            "/oracle/reference-spec.md. Split the maker's presentations into decisions; for each, "
            "record the reference item(s) touched, whether the maker's presentation DIVERGED from "
            "the reference, and whether the client's reaction CAUGHT it (negate/correct/extend/"
            "select) or let it pass (a satisficing miss). Exclude pure implementation/style "
            "preferences orthogonal to reference items. Include EVERY caught divergence and "
            "EVERY satisficing miss as a separate object in decisions; do not put miss details "
            "in a separate field. n_g = number of caught divergences. "
            f"Return ONE JSON object: {NG_SCHEMA}"
        )
        raw = _ask(prompt)
    finally:
        subprocess.run(["docker", "rm", "-f", JUDGE],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        shutil.rmtree(workdir, ignore_errors=True)
    try:
        start, end = raw.index("{"), raw.rindex("}") + 1
        return json.loads(raw[start:end])
    except (ValueError, json.JSONDecodeError):
        return {"raw": raw, "parse_error": True}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("run", type=Path, help="path to runs/<ID>/run-NN")
    ap.add_argument("--mode", choices=["coverage", "co-construction"], default="coverage")
    args = ap.parse_args()

    if args.mode == "coverage":
        result = coverage(args.run)
        out = args.run / "judgment.json"
    else:
        result = co_construction(args.run)
        out = args.run / "ng-judgment.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[judge] wrote {out}"
          + (f"  (n_g={result.get('n_g')})" if "n_g" in result else ""))


if __name__ == "__main__":
    main()
