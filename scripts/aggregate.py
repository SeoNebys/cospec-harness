#!/usr/bin/env python3
"""Aggregate archived runs into a per-condition metrics table.

Reads runs/<ID>/run-NN/{broker-log.json, judgment.json} and computes the cost
and outcome metrics reported in the comparison chapter:

  utterances  - client (natural-language) turns
  input_chars - cumulative chars the client sent (relayed content)
  throughput  - cumulative maker-message chars plus presented SDD document chars
  chunk       - per-turn content presented to the client (median / max)
  coverage    - present + 0.5*partial, split core / extended (from judgment.json)

Usage:
  python scripts/aggregate.py                 # markdown table over all runs
  python scripts/aggregate.py --csv out.csv
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import statistics
from collections import Counter, defaultdict
from pathlib import Path

import harness
import yaml
from co_construction import has_response_classes, summarise

# Stall-terminated runs (VC/SDD) end with this many device-confirmation rounds —
# the guard requires STALL_ROUNDS consecutive no-artifact-change rounds to declare
# settlement, so the trailing block adds no method interaction and is excluded
# from cost. COSPEC terminates on the maker's cycle state, so it has none.
STALL_ROUNDS = int(os.environ.get("HARNESS_STALL_ROUNDS", "3"))


def _cov(judgment: dict, key: str) -> float | None:
    section = judgment.get(key)
    if not isinstance(section, dict):
        return None
    vals = list(section.values())
    if not vals:
        return None
    score = sum(1.0 if v == "present" else 0.5 if v == "partial" else 0.0 for v in vals)
    return round(100 * score / len(vals))


def _doc_chars(run: Path) -> dict:
    """Full Unicode character counts of each round's presented SDD documents.

    Broker copies specification and planning Markdown into presentation/round-*.
    Count each snapshot in full, including unchanged or shortened re-presentations;
    prototype HTML, images, and implementation files are outside this measure.
    """
    counts = {}
    pres = run / "presentation"
    if not pres.exists():
        return counts
    for rd in sorted(pres.glob("round-*")):
        try:
            n = int(rd.name.split("-")[1])
        except (IndexError, ValueError):
            continue
        counts[n] = sum(len(f.read_text(encoding="utf-8")) for f in rd.glob("*.md"))
    return counts


def _is_sdd(run: Path) -> bool:
    mf = run / "meta.json"
    if not mf.exists():
        return False
    m = json.loads(mf.read_text(encoding="utf-8"))
    return m.get("method") == "sdd"


def _effective_cut(run: Path, max_round: int) -> int:
    """Last round to count for cost. Stall-settled runs drop the trailing
    STALL_ROUNDS confirmation rounds; converged (COSPEC) runs keep all."""
    sf = run / "session" / "usage-summary.json"
    terminated = ""
    if sf.exists():
        terminated = str(json.loads(sf.read_text(encoding="utf-8")).get("terminated") or "")
    return max_round - STALL_ROUNDS if "settled" in terminated else max_round


def run_metrics(run: Path) -> dict | None:
    log_f = run / "broker-log.json"
    if not log_f.exists():
        return None
    log = json.loads(log_f.read_text(encoding="utf-8"))
    max_round = max((e["round"] for e in log if e.get("role") in ("maker", "client")), default=0)
    # Exclude the device-confirmation tail (see STALL_ROUNDS) from cost metrics.
    log = [e for e in log if e.get("round", 0) <= _effective_cut(run, max_round)]
    client = [e for e in log if e.get("role") == "client"]
    # Measure presented text, regardless of whether the client actually read it.
    # Both SDD engagement policies include each round's full document snapshot.
    docs = _doc_chars(run) if _is_sdd(run) else {}
    chunks = [e["chars"] + docs.get(e["round"], 0) for e in log if e.get("role") == "maker"]
    m = {
        "utterances": len(client),
        "input_chars": sum(e["chars"] for e in client),
        "throughput": sum(chunks),
        "chunk_median": round(statistics.median(chunks)) if chunks else 0,
        "chunk_max": max(chunks) if chunks else 0,
        "core": None, "extended": None, "n_g": None,
        "n_c": None, "n_a": None, "n_m": None, "accepted_divergences": None,
        "unexpressed_divergences": None, "unresolved_decisions": None,
        "capture_rate": None, "judgment_format": None,
    }
    jf = run / "judgment.json"
    if jf.exists():
        j = json.loads(jf.read_text(encoding="utf-8"))
        m["core"], m["extended"] = _cov(j, "core"), _cov(j, "extended")
    nf = run / "ng-judgment.json"
    if nf.exists():
        n = json.loads(nf.read_text(encoding="utf-8"))
        if n.get("parse_error") or n.get("validation_error"):
            return m
        if has_response_classes(n):
            n = summarise(n)
            for key in ("n_g", "n_c", "n_a", "n_m", "accepted_divergences", "unexpressed_divergences",
                        "unresolved_decisions", "capture_rate"):
                m[key] = n[key]
            m["judgment_format"] = "response-classes"
        elif isinstance(n.get("n_g"), (int, float)):
            m["n_g"] = n["n_g"]
            m["judgment_format"] = "catch-flags"
    return m


def planned_counts() -> dict[str, int]:
    """Return the predeclared number of runs per condition."""
    plan = yaml.safe_load(
        (harness.CONFIG / "run-plan.yaml").read_text(encoding="utf-8")
    )["run_plan"]
    if plan.get("order") == "sequence":
        return dict(Counter(plan.get("sequence", [])))
    repeat = int(plan["repeat"])
    return {cond: repeat for cond in plan["conditions"]}


def collect(run_policy: str = "planned") -> dict[str, list[dict]]:
    """Collect metrics from either predeclared or every archived run.

    The planned policy is the default so an ad-hoc supplemental run cannot
    silently change the primary analysis.
    """
    if run_policy not in {"planned", "all"}:
        raise ValueError(f"unknown run policy: {run_policy}")
    limits = planned_counts() if run_policy == "planned" else {}
    by_cond: dict[str, list[dict]] = defaultdict(list)
    for cond_dir in sorted(harness.RUNS.glob("*")):
        if not cond_dir.is_dir():
            continue
        runs = sorted(cond_dir.glob("run-*"))
        if run_policy == "planned":
            runs = runs[:limits.get(cond_dir.name, 0)]
        for run in runs:
            m = run_metrics(run)
            if m:
                by_cond[cond_dir.name].append(m)
    return by_cond


def _avg(rows: list[dict], key: str):
    vals = [r[key] for r in rows if r.get(key) is not None]
    return round(sum(vals) / len(vals), 4 if key == "capture_rate" else 1) if vals else "-"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path)
    ap.add_argument(
        "--run-policy",
        choices=("planned", "all"),
        default="planned",
        help="planned: honor run-plan.yaml (default); all: include supplemental runs",
    )
    args = ap.parse_args()

    by_cond = collect(args.run_policy)
    formats = {row["judgment_format"] for rows in by_cond.values() for row in rows
               if row.get("judgment_format") is not None}
    if len(formats) > 1:
        raise SystemExit("[aggregate] incompatible judgment fields; reassess or analyse separately")
    cols = ["utterances", "input_chars", "throughput", "chunk_median", "chunk_max", "core", "extended", "n_g"]
    if formats == {"response-classes"}:
        cols += ["n_c", "n_a", "n_m", "accepted_divergences", "unexpressed_divergences",
                 "unresolved_decisions", "capture_rate"]

    if args.csv:
        with args.csv.open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["condition", "runs", *cols])
            for cond, rows in by_cond.items():
                w.writerow([cond, len(rows), *[_avg(rows, c) for c in cols]])
        print(f"[aggregate] wrote {args.csv}")
        return

    print(f"| condition | runs | {' | '.join(cols)} |")
    print("|" + "---|" * (len(cols) + 2))
    for cond, rows in by_cond.items():
        print(f"| {cond} | {len(rows)} | " + " | ".join(str(_avg(rows, c)) for c in cols) + " |")


if __name__ == "__main__":
    main()
