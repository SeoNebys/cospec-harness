#!/usr/bin/env python3
"""Validate N_g judgments and produce descriptive experiment statistics.

Raw run archives are never modified. Inconsistent historical N_g schemas are
normalised in memory, with any reconstructable missing detail supplied through
analysis/ng-adjudication-addendum.json.

The primary analysis honors config/run-plan.yaml. Supplemental runs are shown
only in sensitivity analyses.
"""
from __future__ import annotations

import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

import aggregate
import harness
from co_construction import has_response_classes, summarise

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ANALYSIS = harness.ROOT / "analysis"
ADDENDUM = ANALYSIS / "ng-adjudication-addendum.json"
METRICS = (
    "utterances",
    "input_chars",
    "throughput",
    "chunk_median",
    "chunk_max",
    "core",
    "extended",
    "n_g",
)
CONDITION_ORDER = ("VC", "SD-S", "CO-S", "SD-D", "CO-D")


def _miss_object(item: dict) -> dict:
    """Fill invariant fields used by older separate miss-detail schemas."""
    return {
        "ref_items": item.get("ref_items", []),
        "diverged": True,
        "caught": False,
        "catch_type": "none",
        "note": item.get("note", ""),
    }


def _dedupe_decisions(items: list[dict]) -> list[dict]:
    seen: set[tuple] = set()
    result: list[dict] = []
    for item in items:
        key = (
            tuple(item.get("ref_items", [])),
            item.get("caught"),
            item.get("catch_type"),
            item.get("note"),
        )
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result


def normalise_ng(run: Path, addendum: dict) -> dict:
    source = run / "ng-judgment.json"
    raw = json.loads(source.read_text(encoding="utf-8"))
    if has_response_classes(raw):
        summary = summarise(raw)
        errors = [f"declared {key}={raw.get(key)}, derived={summary[key]}"
                  for key in ("n_g", "n_c", "n_a", "n_m", "accepted_divergences",
                              "unexpressed_divergences", "unresolved_decisions",
                              "opportunities", "capture_rate")
                  if raw.get(key) != summary[key]]
        return {
            "run": f"{run.parent.name}/{run.name}",
            "source": str(source.relative_to(harness.ROOT)).replace("\\", "/"),
            "judgment_format": "response-classes",
            "miss_schema": "response-classes",
            "used_separate_miss_detail": False, "used_addendum": False,
            "declared_n_g": raw.get("n_g"), "declared_misses": raw.get("n_m"),
            # detailed_misses denotes unexpressed divergences N_m.
            "detailed_caught": summary["n_g"], "detailed_misses": summary["n_m"],
            "n_c": summary["n_c"], "n_a": summary["n_a"],
            "accepted_divergences": summary["accepted_divergences"],
            "unexpressed_divergences": summary["unexpressed_divergences"],
            "unresolved_decisions": summary["unresolved_decisions"],
            "opportunities": summary["opportunities"],
            "catch_rate": summary["capture_rate"],
            "status": "error" if errors else "ok", "errors": errors,
        }
    decisions = list(raw.get("decisions", []))

    # A reference-preserving selection counts even when the selected alternative
    # itself is marked diverged=false; the unselected alternative is the
    # divergence the client caught. Historical judges use this representation
    # in CO-D/run-05 and SD-D/run-03.
    caught = [d for d in decisions if d.get("caught") is True]
    misses = [
        d
        for d in decisions
        if d.get("diverged") is True and d.get("caught") is False
    ]

    miss_field = raw.get("satisficing_misses", 0)
    if isinstance(miss_field, list):
        declared_misses = len(miss_field)
        misses.extend(_miss_object(d) for d in miss_field)
        miss_schema = "decision-list"
    elif isinstance(miss_field, (int, float)):
        declared_misses = int(miss_field)
        miss_schema = "count"
    else:
        declared_misses = -1
        miss_schema = type(miss_field).__name__

    separate = raw.get("satisficing_miss_detail", [])
    if isinstance(separate, list):
        misses.extend(_miss_object(d) for d in separate)

    run_key = f"{run.parent.name}/{run.name}"
    patch = addendum.get(run_key, {})
    misses.extend(_miss_object(d) for d in patch.get("misses", []))
    misses = _dedupe_decisions(misses)

    declared_caught = raw.get("n_g")
    errors = []
    if declared_caught != len(caught):
        errors.append(
            f"declared n_g={declared_caught}, detailed caught={len(caught)}"
        )
    if declared_misses != len(misses):
        errors.append(
            f"declared misses={declared_misses}, detailed misses={len(misses)}"
        )

    opportunities = len(caught) + len(misses)
    return {
        "run": run_key,
        "judgment_format": "catch-flags",
        "source": str(source.relative_to(harness.ROOT)).replace("\\", "/"),
        "miss_schema": miss_schema,
        "used_separate_miss_detail": bool(separate),
        "used_addendum": bool(patch),
        "declared_n_g": declared_caught,
        "declared_misses": declared_misses,
        "detailed_caught": len(caught),
        "detailed_misses": len(misses),
        "opportunities": opportunities,
        "catch_rate": len(caught) / opportunities if opportunities else None,
        "status": "ok" if not errors else "error",
        "errors": errors,
    }


def _describe(values: list[float]) -> dict:
    if not values:
        return {"n": 0, "mean": None, "sd": None, "min": None, "max": None}
    return {
        "n": len(values),
        "mean": statistics.mean(values),
        "sd": statistics.stdev(values) if len(values) > 1 else 0.0,
        "min": min(values),
        "max": max(values),
    }


def _condition_metrics(run_policy: str) -> dict:
    result = {}
    for cond, rows in aggregate.collect(run_policy).items():
        result[cond] = {
            key: _describe([row[key] for row in rows if row.get(key) is not None])
            for key in METRICS
        }
    return result


def _run_dirs(run_policy: str) -> dict[str, list[Path]]:
    limits = aggregate.planned_counts()
    result = {}
    for cond_dir in sorted(harness.RUNS.glob("*")):
        if not cond_dir.is_dir():
            continue
        runs = sorted(cond_dir.glob("run-*"))
        if run_policy == "planned":
            runs = runs[: limits.get(cond_dir.name, 0)]
        result[cond_dir.name] = runs
    return result


def _catch_summary(validations: dict[str, dict], run_policy: str) -> dict[str, dict]:
    result = {}
    formats = {row["judgment_format"] for row in validations.values()}
    if len(formats) > 1:
        raise ValueError("incompatible judgment fields; reassess or analyse separately")
    for cond, runs in _run_dirs(run_policy).items():
        rows = [validations[f"{cond}/{run.name}"] for run in runs]
        caught = sum(row["detailed_caught"] for row in rows)
        misses = sum(row["detailed_misses"] for row in rows)
        rates = [row["catch_rate"] for row in rows if row["catch_rate"] is not None]
        result[cond] = {
            "runs": len(rows),
            "caught": caught,
            "misses": misses,
            "opportunities": caught + misses,
            "pooled_catch_rate": caught / (caught + misses) if caught + misses else None,
            "run_rate": _describe(rates),
        }
        if formats == {"response-classes"}:
            result[cond].update({key: sum(row[key] for row in rows) for key in
                                 ("n_c", "n_a", "accepted_divergences", "unexpressed_divergences",
                                  "unresolved_decisions")})
    return result


def _co_d_sensitivity() -> dict:
    run_dir = harness.RUNS / "CO-D"
    all_runs = sorted(run_dir.glob("run-*"))
    groups = {
        "planned_run_01_to_05": all_runs[:5],
        "all_run_01_to_06": all_runs,
        "replace_run_03_with_run_06": [
            run for run in all_runs if run.name != "run-03"
        ],
    }
    result = {}
    for name, runs in groups.items():
        rows = [aggregate.run_metrics(run) for run in runs]
        result[name] = {
            "runs": [run.name for run in runs],
            "metrics": {
                key: _describe([row[key] for row in rows if row.get(key) is not None])
                for key in METRICS
            },
        }
    return result


def _fmt_stat(stat: dict, digits: int = 1) -> str:
    if not stat["n"]:
        return "-"
    return (
        f"{stat['mean']:,.{digits}f} ± {stat['sd']:,.{digits}f} "
        f"[{stat['min']:,.{digits}f}–{stat['max']:,.{digits}f}]"
    )


def _markdown(
    primary: dict, catches: dict, sensitivity: dict, validations: dict
) -> str:
    lines = [
        "# Experiment descriptive statistics",
        "",
        "Generated by `python scripts/audit_statistics.py`. Raw run archives are not modified.",
        "",
        "## Primary analysis",
        "",
        "The primary analysis uses the five runs per condition declared in `config/run-plan.yaml`.",
        "",
        "| condition | utterances | input chars | throughput | chunk median | chunk max |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for cond in CONDITION_ORDER:
        row = primary[cond]
        lines.append(
            f"| {cond} | {_fmt_stat(row['utterances'])} | "
            f"{_fmt_stat(row['input_chars'])} | {_fmt_stat(row['throughput'])} | "
            f"{_fmt_stat(row['chunk_median'])} | {_fmt_stat(row['chunk_max'])} |"
        )
    lines.extend(
        [
            "",
            "| condition | core coverage | extended coverage | N_g |",
            "|---|---:|---:|---:|",
        ]
    )
    for cond in CONDITION_ORDER:
        row = primary[cond]
        lines.append(
            f"| {cond} | {_fmt_stat(row['core'])} | "
            f"{_fmt_stat(row['extended'])} | {_fmt_stat(row['n_g'])} |"
        )
    lines.extend(
        [
            "",
            "## Opportunity-normalised co-construction",
            "",
            "`catch rate = N_g / (N_g + satisficing misses)`",
            "",
            "| condition | runs | caught | missed | pooled rate | run-level rate mean ± SD |",
            "|---|---:|---:|---:|---:|---:|",
        ]
    )
    for cond in CONDITION_ORDER:
        row = catches[cond]
        rate = row["run_rate"]
        pooled = f"{100 * row['pooled_catch_rate']:.1f}%" if row["pooled_catch_rate"] is not None else "-"
        run_rate = f"{100 * rate['mean']:.1f}% ± {100 * rate['sd']:.1f}%" if rate["n"] else "-"
        lines.append(
            f"| {cond} | {row['runs']} | {row['caught']} | {row['misses']} | "
            f"{pooled} | {run_rate} |"
        )
    if all(row["judgment_format"] == "response-classes" for row in validations.values()):
        lines = [line.replace(
            "`catch rate = N_g / (N_g + satisficing misses)`",
            "`capture rate = N_g / (N_g + N_m)`; N_g = N_c + N_a counts corrective "
            "and explicitly accepting responses. N_m counts unexpressed divergences."
        ).replace("| caught | missed |", "| captured N_g | unexpressed N_m |") for line in lines]
        lines += ["", "| condition | corrective N_c | accepted N_a | unexpressed N_m | unresolved |",
                  "|---|---:|---:|---:|---:|"]
        for cond in CONDITION_ORDER:
            row = catches[cond]
            lines.append(f"| {cond} | {row['n_c']} | {row['n_a']} | "
                         f"{row['unexpressed_divergences']} | {row['unresolved_decisions']} |")
    lines.extend(
        [
            "",
            "## CO-D supplemental-run sensitivity",
            "",
            "| policy | runs | utterances | input chars | throughput | chunk median | chunk max | core | extended | N_g |",
            "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
        ]
    )
    labels = {
        "planned_run_01_to_05": "planned",
        "all_run_01_to_06": "all archived",
        "replace_run_03_with_run_06": "replace run-03",
    }
    for key, row in sensitivity.items():
        metrics = row["metrics"]
        means = [metrics[name]["mean"] for name in METRICS]
        lines.append(
            f"| {labels[key]} | {', '.join(row['runs'])} | "
            + " | ".join(f"{value:,.1f}" for value in means)
            + " |"
        )

    schema_counts: dict[str, int] = defaultdict(int)
    for row in validations.values():
        schema_counts[row["miss_schema"]] += 1
    lines.extend(
        [
            "",
            "## Judgment validation",
            "",
            f"- Validated runs: {len(validations)}",
            f"- Validation errors: "
            f"{sum(row['status'] != 'ok' for row in validations.values())}",
            f"- Historical miss schemas: {dict(sorted(schema_counts.items()))}",
            f"- Runs using a separate miss-detail field: "
            f"{sum(row['used_separate_miss_detail'] for row in validations.values())}",
            f"- Runs using the adjudication addendum: "
            f"{sum(row['used_addendum'] for row in validations.values())}",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    addendum = json.loads(ADDENDUM.read_text(encoding="utf-8"))
    validations = {}
    for _, runs in _run_dirs("all").items():
        for run in runs:
            row = normalise_ng(run, addendum)
            validations[row["run"]] = row

    errors = [row for row in validations.values() if row["status"] != "ok"]
    if errors:
        for row in errors:
            print(f"[audit] {row['run']}: {'; '.join(row['errors'])}", file=sys.stderr)
        raise SystemExit(1)

    primary = _condition_metrics("planned")
    catches = _catch_summary(validations, "planned")
    sensitivity = _co_d_sensitivity()
    result = {
        "primary_policy": {
            "source": "config/run-plan.yaml",
            "description": "first five archived runs per condition",
        },
        "primary_metrics": primary,
        "primary_catch_rates": catches,
        "co_d_sensitivity": sensitivity,
    }

    ANALYSIS.mkdir(parents=True, exist_ok=True)
    (ANALYSIS / "ng-validation.json").write_text(
        json.dumps(validations, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (ANALYSIS / "experiment-statistics.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (ANALYSIS / "experiment-statistics.md").write_text(
        _markdown(primary, catches, sensitivity, validations),
        encoding="utf-8",
    )
    print(f"[audit] validated {len(validations)} runs")
    print(f"[audit] wrote derived results under {ANALYSIS}")


if __name__ == "__main__":
    main()
