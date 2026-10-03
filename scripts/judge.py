#!/usr/bin/env python3
"""Blind judge — post-hoc coverage scoring, run separately from the live loop.

The judge sees ONLY the final implementation code (mounted read-only) and the
reference spec + rubric. It does not see the condition, the transcript, or who
produced the code — preventing the party that steered the reaction from also
scoring the result.

Usage:
  python scripts/judge.py runs/CO-D/run-01
  python scripts/judge.py runs/CO-D/run-01 --mode co-construction   # see note below

Writes <run>/judgments/<provider>/judgment.json (or ng-judgment.json).
Defaults to both configured judges; --judge selects a single service.

Coverage mode judges each REF-BM-### as present/partial/absent from the code.
Co-construction (N_g) mode reads the (condition-stripped) broker-log and counts
mismatch captures per the co-construction rubric; it is a distinct pass because
it needs the interaction record rather than the code.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

import harness
import llm
from co_construction import summarise, summarise_in_scope

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

JUDGE = "judge"
JUDGE_CONFIGS = harness.ROOT / "judge-configs"
COVERAGE_SCHEMA = (
    '{"core": {"REF-BM-01": "present|partial|absent", ...}, '
    '"extended": {"REF-BM-23": "...", ...}, '
    '"notes": "brief justification per non-present item"}'
)

NG_SCHEMA = (
    '{"decisions": [{"ref_items": ["REF-BM-06"], '
    '"diverged": true, "response_class": '
    '"corrective|accepted_divergence|unexpressed_divergence|unresolved|not_divergent", '
    '"caught": true, "catch_type": "negate|correct|extend|select|none", '
    '"evidence": "presentation/response locations and short excerpts", '
    '"note": "classification reason and stage"}]}'
)


def _run_judge_container(artifacts: Path, model: llm.Model, workdir: Path) -> None:
    shutil.copytree(JUDGE_CONFIGS, workdir, dirs_exist_ok=True)
    harness.adapt_policy(workdir, model.provider)
    subprocess.run(["docker", "rm", "-f", JUDGE],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    harness._run_detached(JUDGE,
        harness._mount(workdir, "/work") + harness._mount(artifacts, "/artifacts", ro=True)
        + harness._mount(harness.ORACLE, "/oracle", ro=True), provider=model.provider)


def _ask(prompt: str, model: llm.Model, record_dir: Path | None = None) -> str:
    policy = harness.policy_filename(model.provider)
    prompt = f"If /work/{policy} exists, read and follow it before judging.\n\n" + prompt
    return llm.invoke(JUDGE, model, prompt, record_dir=record_dir)["result"]


def extract_judgment(raw: str, required_keys: set[str]) -> dict:
    """Read one judgment object without treating prose/code braces as JSON.

    Skip whole decoded values so nested objects are not separate candidates.
    Multiple judgment objects are ambiguous and still require inspection.
    Schema and scoring validation remain the caller's responsibility.
    """
    decoder = json.JSONDecoder()
    candidates = []
    consumed = 0
    for match in re.finditer(r"[\[{]", raw):
        if match.start() < consumed:
            continue
        try:
            value, end = decoder.raw_decode(raw, match.start())
        except json.JSONDecodeError:
            continue
        consumed = end
        if isinstance(value, dict) and required_keys <= value.keys():
            candidates.append(value)
    if len(candidates) != 1:
        raise ValueError('Expected exactly one judgment JSON object')
    return candidates[0]


def coverage(run: Path, model: llm.Model | None = None, record_dir: Path | None = None) -> dict:
    model = model or llm.select("judge", "claude")
    artifacts = run / "maker-workspace"
    if not artifacts.exists():
        raise SystemExit(f"[judge] no maker-workspace under {run}")
    workdir = Path(tempfile.mkdtemp(prefix="coverage-judge-"))
    try:
        _run_judge_container(artifacts, model, workdir)
        prompt = (
            "Judge coverage of the implementation under /artifacts against the "
            "functional requirements in /oracle/reference-spec.md, following "
            "/oracle/rubrics/coverage.md. You do not know which method produced it. "
            "For every REF-BM-### mark present/partial/absent from the CODE ONLY. "
            f"Return a single JSON object of the form: {COVERAGE_SCHEMA}"
        )
        raw = _ask(prompt, model, record_dir)
    finally:
        subprocess.run(["docker", "rm", "-f", JUDGE],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        shutil.rmtree(workdir, ignore_errors=True)
    try:
        return extract_judgment(raw, {'core', 'extended'})
    except (ValueError, json.JSONDecodeError):
        return {"raw": raw, "parse_error": True}


def co_construction(run: Path, model: llm.Model | None = None, record_dir: Path | None = None) -> dict:
    """Count co-constructed decisions (N_g) from the transcript, per the rubric.

    Distinct from coverage: needs the interaction record, not the code. Mounts
    ONLY the broker-log (not meta/context, which name the condition) + oracle, in
    a clean empty cwd, so the judge stays blind to the condition."""
    model = model or llm.select("judge", "claude")
    log = run / "broker-log.json"
    if not log.exists():
        log = run / "session" / "broker-log.json"
    if not log.exists():
        raise SystemExit(f"[judge] no broker-log under {run}")

    workdir = Path(tempfile.mkdtemp(prefix="ng-judge-"))
    subprocess.run(["docker", "rm", "-f", JUDGE],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        harness._run_detached(JUDGE,
            harness._mount(workdir, "/work") + harness._mount(log, "/transcript/broker-log.json", ro=True)
            + harness._mount(harness.ORACLE, "/oracle", ro=True), provider=model.provider)
        prompt = (
            "You are a blind co-construction judge; you do not know which method produced "
            "this session. Read the transcript at /transcript/broker-log.json — role 'maker' "
            "entries are the builder's presentations, role 'client' entries are the requester's "
            "reactions. Follow /oracle/rubrics/co-construction.md, anchoring 'divergence' to "
            "/oracle/reference-spec.md. Split the maker's presentations into decisions; for each, "
            "establish divergence independently of the response, then classify the response as "
            "corrective, accepted_divergence, unexpressed_divergence, or unresolved. "
            "Use not_divergent for recorded conforming decisions. Follow the rubric's flag "
            "combinations; diverged may be null only when evidence cannot establish divergence. "
            "caught is true for corrective and accepted_divergence: the response surfaces a "
            "difference and expresses a corrective or accepting disposition. For an accepted "
            "divergence use catch_type=none; require the client's own explicit statement of the "
            "expectation or difference and acceptance. Bare approval does not qualify even if the "
            "maker has explained the difference. Judge content, not response length. "
            "An expectation expressed in a still-pending clarification remains unresolved; "
            "record the expression in evidence. "
            "Exclude equivalent implementations and preferences orthogonal to reference items. "
            "Include EVERY classified divergence and unresolved decision, with transcript locations "
            "and short excerpts as evidence. Link clarification to its eventual disposition without "
            "double-counting the pending decision. Do not infer awareness from bare approval. "
            "Aggregate counts will be computed from decisions by code. "
            f"Return ONE JSON object: {NG_SCHEMA}"
        )
        raw = _ask(prompt, model, record_dir)
    finally:
        subprocess.run(["docker", "rm", "-f", JUDGE],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        shutil.rmtree(workdir, ignore_errors=True)
    try:
        parsed = extract_judgment(raw, {'decisions'})
    except (ValueError, json.JSONDecodeError):
        return {"raw": raw, "parse_error": True}
    try:
        return summarise_in_scope(parsed)
    except ValueError as exc:
        return {"raw": raw, "validation_error": True, "error": str(exc)}


def validate_result(result: dict, mode: str) -> None:
    if not isinstance(result, dict) or result.get('parse_error') or result.get('validation_error'):
        raise ValueError('Judge result contains a parse or validation error')
    if mode == 'coverage':
        for section, first, last in (('core', 1, 22), ('extended', 23, 32)):
            values = result.get(section)
            if not isinstance(values, dict) or set(values) != {f'REF-BM-{i:02d}' for i in range(first, last + 1)}:
                raise ValueError('Coverage result must include every reference item exactly once')
            if any(value not in ('present', 'partial', 'absent') for value in values.values()):
                raise ValueError('Invalid coverage verdict')
    elif mode == 'co-construction':
        computed = summarise_in_scope(result)
        for key, value in computed.items():
            if result.get(key) != value:
                raise ValueError('Co-construction totals do not match decisions')
    else:
        raise ValueError('Unknown judgment mode')


def result_path(run: Path, provider: str, mode: str) -> Path:
    filename = 'judgment.json' if mode == 'coverage' else 'ng-judgment.json'
    return run / 'judgments' / provider / filename


def run_one(run: Path, mode: str, model: llm.Model) -> Path:
    out = result_path(run, model.provider, mode)
    if out.exists():
        validate_result(json.loads(out.read_text()), mode)
        print(f'[judge] valid existing result; skipped: {out}')
        return out
    calls = out.parent / ('coverage-calls' if mode == 'coverage' else 'co-construction-calls')
    result = (coverage if mode == 'coverage' else co_construction)(run, model, calls)
    result['_execution'] = {'model': model.metadata(), 'image_id': subprocess.check_output(
        ['docker', 'image', 'inspect', harness.IMAGE, '--format', '{{.Id}}'], text=True).strip()}
    out.parent.mkdir(parents=True, exist_ok=True)
    temporary = out.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(out)
    validate_result(result, mode)  # Preserve invalid evidence, but never count it as complete.
    print(f'[judge] wrote {out}')
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("run", type=Path, help="path to runs/<ID>/run-NN")
    ap.add_argument("--mode", choices=["coverage", "co-construction"], default="coverage")
    ap.add_argument("--judge", choices=["all", "claude", "codex"], default="all")
    args = ap.parse_args()

    providers = llm.judges() if args.judge == "all" else [args.judge]
    for provider in providers:
        model = llm.select("judge", provider)
        run_one(args.run, args.mode, model)


if __name__ == "__main__":
    main()
