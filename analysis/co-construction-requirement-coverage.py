#!/usr/bin/env python3
"""Read-only reaggregation of existing Judge decisions by reference requirement.

Standard library only. Does not import experiment execution modules, invoke an
LLM, alter classifications, or modify the source run records.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import statistics
from pathlib import Path

CONDITIONS = ("VC", "SD-S", "CO-S", "SD-D", "CO-D")
CORE = {f"REF-BM-{i:02d}" for i in range(1, 23)}
EXTENDED = {f"REF-BM-{i:02d}" for i in range(23, 33)}
CAPTURED = {"corrective", "accepted_divergence"}
CLASSES = CAPTURED | {"unexpressed_divergence", "unresolved", "not_divergent"}
PREFIX = "co-construction-requirement-coverage"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def measure(judgment):
    """Union existing captured ref_items; preserve all original decisions."""
    if judgment.get("parse_error") or judgment.get("validation_error"):
        raise ValueError("Invalid source judgment")
    classes = {name: 0 for name in CLASSES}
    captured = []
    requirements = {}
    multi = []
    for index, decision in enumerate(judgment["decisions"], 1):
        response = decision["response_class"]
        refs = set(decision["ref_items"])
        if response not in CLASSES or not refs or not refs <= CORE | EXTENDED:
            raise ValueError(f"Invalid class or reference IDs in decision {index}")
        classes[response] += 1
        if response not in CAPTURED:
            continue
        if decision.get("caught") is not True or decision.get("diverged") is not True:
            raise ValueError(f"Inconsistent captured decision {index}")
        if not decision.get("evidence") or not decision.get("note"):
            raise ValueError(f"Missing evidence in decision {index}")
        captured.append({"decision_index_1based": index, "original_decision": decision})
        if len(refs) > 1:
            multi.append(index)
        for ref in sorted(refs):
            requirements.setdefault(ref, []).append({
                "decision_index_1based": index, "response_class": response,
            })
    nc, na, nm = (classes[k] for k in
                  ("corrective", "accepted_divergence", "unexpressed_divergence"))
    ng = nc + na
    opportunity = ng + nm
    rate = ng / opportunity if opportunity else None
    for key, value in {"n_c": nc, "n_a": na, "n_g": ng, "n_m": nm,
                       "opportunities": opportunity}.items():
        if key in judgment and judgment[key] != value:
            raise ValueError(f"Source count mismatch: {key}")
    if "capture_rate" in judgment:
        saved = judgment["capture_rate"]
        if (saved is None) != (rate is None) or (
                saved is not None and not math.isclose(saved, rate)):
            raise ValueError("Source capture rate mismatch")
    refs = set(requirements)
    metrics = {
        "n_c": nc, "n_a": na, "n_g": ng, "n_m": nm,
        "opportunities": opportunity, "capture_rate": rate,
        "core_items": len(refs & CORE), "core_denominator": len(CORE),
        "core_coverage_pct": 100 * len(refs & CORE) / len(CORE),
        "extended_items": len(refs & EXTENDED), "extended_denominator": len(EXTENDED),
        "extended_coverage_pct": 100 * len(refs & EXTENDED) / len(EXTENDED),
        "multi_ref_captured_decisions": len(multi),
    }
    trace = {
        "core_refs": sorted(refs & CORE), "extended_refs": sorted(refs & EXTENDED),
        "corrective_refs": sorted({ref for ref, links in requirements.items()
                                   if any(x["response_class"] == "corrective" for x in links)}),
        "accepted_divergence_refs": sorted({ref for ref, links in requirements.items()
                                            if any(x["response_class"] == "accepted_divergence" for x in links)}),
        "requirements": requirements, "captured_decisions": captured,
        "multi_ref_decision_indices_1based": multi,
        "link_review_status": "not_semantically_adjudicated",
        "excluded_decisions": judgment.get("excluded_decisions", []),
    }
    return metrics, trace


def write_csv(path, rows):
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def self_test():
    def decision(kind, refs):
        return dict(response_class=kind, ref_items=refs, caught=kind in CAPTURED,
                    diverged=kind != "not_divergent", evidence="fixture", note="fixture")
    metrics, trace = measure({"decisions": [
        decision("corrective", ["REF-BM-02"]),
        decision("corrective", ["REF-BM-02", "REF-BM-03"]),
        decision("accepted_divergence", ["REF-BM-02", "REF-BM-24"]),
        decision("unexpressed_divergence", ["REF-BM-10"]),
        decision("not_divergent", ["REF-BM-01"]),
        decision("unresolved", ["REF-BM-32"]),
    ]})
    assert metrics["n_g"] == 3 and metrics["capture_rate"] == .75
    assert metrics["core_items"] == 2 and metrics["extended_items"] == 1
    assert metrics["extended_coverage_pct"] == 10
    assert trace["accepted_divergence_refs"] == ["REF-BM-02", "REF-BM-24"]
    assert len(trace["requirements"]["REF-BM-02"]) == 3
    empty, _ = measure({"decisions": []})
    assert empty["capture_rate"] is None and empty["core_coverage_pct"] == 0
    for bad in [{"decisions": [decision("corrective", ["REF-BM-I01"])]},
                {"decisions": [], "n_g": 1}]:
        try:
            measure(bad)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid source accepted")
    print("Self-test passed: deduplication, cross-class overlap, scope, empty set, counts.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--experiment-root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument("--blocks", nargs="+", type=int, default=[1, 2, 3, 4, 5])
    parser.add_argument("--judges", nargs="+", default=["claude", "codex"])
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if args.experiment_root is None:
        parser.error("--experiment-root is required")
    root, out = args.experiment_root.resolve(), args.output_dir.resolve()
    if out == root / "runs" or root / "runs" in out.parents:
        parser.error("Output directory must be outside the source runs directory")
    out.mkdir(parents=True, exist_ok=True)
    if len(set(args.blocks)) != len(args.blocks) or len(set(args.judges)) != len(args.judges):
        parser.error("Duplicate block or Judge")
    source_hashes = {}

    def read_source(relative, as_json=True):
        path = root / relative
        data = path.read_bytes()
        source_hashes[relative] = hashlib.sha256(data).hexdigest()
        return json.loads(data) if as_json else data.decode("utf-8")

    state = read_source("runs/execution-state.json")
    read_source("oracle/reference-spec.md", as_json=False)
    for block in args.blocks:
        if state["blocks"][str(block)]["status"] != "judged":
            raise ValueError(f"Block {block} is not fully judged")
    trials = sorted((t for t in state["trials"] if t["block"] in args.blocks),
                    key=lambda t: t["order"])
    if not trials:
        raise ValueError("No selected trials")
    rows, traces = [], []
    identities = set()
    for trial in trials:
        if trial["status"] != "completed":
            raise ValueError(f"Incomplete trial: {trial['trial_id']}")
        run = f"runs/{trial['condition']}/run-{trial['run']:02d}"
        if run in identities:
            raise ValueError(f"Duplicate run: {run}")
        identities.add(run)
        meta = read_source(f"{run}/meta.json")
        if meta["trial"]["trial_id"] != trial["trial_id"]:
            raise ValueError(f"Archive identity mismatch: {run}")
        for provider in args.judges:
            relative = f"{run}/judgments/{provider}/ng-judgment.json"
            judgment = read_source(relative)
            saved = trial["judgments"][f"{provider}/co-construction"]
            if saved["status"] != "completed" or saved["sha256"] != source_hashes[relative]:
                raise ValueError(f"Judgment differs from completed execution record: {relative}")
            metrics, trace = measure(judgment)
            identity = {k: trial[k] for k in ("trial_id", "block", "condition",
                                             "maker", "director", "maker_effort", "director_effort")}
            identity.update(run=run, judge=provider)
            rows.append(identity | metrics)
            traces.append(identity | {"source": relative, "metrics": metrics} | trace)
    summaries = []
    for provider in args.judges:
        for condition in CONDITIONS:
            selected = [r for r in rows if r["judge"] == provider and r["condition"] == condition]
            if not selected:
                continue
            summary = {"judge": provider, "condition": condition, "runs": len(selected)}
            for key in ("core_items", "extended_items", "core_coverage_pct", "extended_coverage_pct",
                        "n_g", "n_m", "capture_rate"):
                values = [r[key] for r in selected if r[key] is not None]
                summary[key + "_n"] = len(values)
                summary[key + "_mean"] = statistics.mean(values) if values else None
                summary[key + "_sd"] = statistics.stdev(values) if len(values) > 1 else None
            summaries.append(summary)
    for relative, original_hash in source_hashes.items():
        if digest(root / relative) != original_hash:
            raise ValueError(f"Source changed during analysis: {relative}")
    out.mkdir(parents=True, exist_ok=True)
    write_csv(out / f"{PREFIX}-runs.csv", rows)
    write_csv(out / f"{PREFIX}-summary.csv", summaries)
    evidence = {
        "basis": "Existing Judge classifications and ref_items; no rejudging or link correction",
        "blocks": args.blocks, "judges": args.judges, "trials": len(trials),
        "core_refs": sorted(CORE), "extended_refs": sorted(EXTENDED),
        "script_sha256": digest(Path(__file__)), "source_sha256": source_hashes,
        "source_paths_relative_to": "--experiment-root", "runs": traces,
    }
    (out / f"{PREFIX}-evidence.json").write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# 공동 구축 요구사항 커버리지 재집계", "",
             f"분석 대상: {len(trials)}회 시행, Judge {', '.join(args.judges)}. 선택 블록: {args.blocks}.", "",
             "기존 Judge 판정의 수정 기여·차이 수용 결정에 연결된 고유 참조 항목을 시행별로 집계하였다. "
             "핵심 22개, 확장 10개를 각각 고정 분모로 사용하며, 같은 항목의 반복 기여와 유형 간 중복은 한 번만 센다. "
             "기존 판정·횟수·포착률은 변경하지 않았다. 결과 확인 후 추가한 분석이다.", "",
             "아래 값은 기존 Judge의 항목 연결을 그대로 사용한 결과이며, 연결의 타당성까지 재판정한 값은 아니다. "
             "모든 세부 조건의 표출이나 구현 여부를 나타내지 않는다.", "",
             "| Judge | 조건 | 시행 수 | 핵심 커버리지, 평균(표준편차) | 확장 커버리지, 평균(표준편차) |",
             "|---|---|---:|---:|---:|"]
    def stat(row, key, scale=1):
        mean, sd = row[key + "_mean"], row[key + "_sd"]
        if mean is None:
            return "계산 불가"
        return f"{mean * scale:.2f} ({sd * scale:.2f})" if sd is not None else f"{mean * scale:.2f} (—)"
    for row in summaries:
        lines.append(f"| {row['judge']} | {row['condition']} | {row['runs']} | "
                     f"{stat(row, 'core_coverage_pct')} | {stat(row, 'extended_coverage_pct')} |")
    lines += ["", "커버리지의 단위는 %. 표준편차는 시행별 값의 표본 표준편차이다.", "",
              "## 기존 지표와 대조", "",
              "| Judge | 조건 | 공동 구축 횟수 평균 | 차이 미표현 횟수 평균 | 관찰된 불일치 포착률, 평균(표준편차), % | 포착률 유효 시행 수 |",
              "|---|---|---:|---:|---:|---:|"]
    for row in summaries:
        lines.append(f"| {row['judge']} | {row['condition']} | {row['n_g_mean']:.2f} | "
                     f"{row['n_m_mean']:.2f} | {stat(row, 'capture_rate', 100)} | {row['capture_rate_n']} |")
    lines += ["", "포착률은 시행별 비율의 평균이며 합산 비율이 아니다. "
              "추가 지표와 기존 지표 모두 Judge별로 독립적으로 산출하였다.", "",
              "## 참조 항목 연결 점검", "",
              f"기여 결정 {sum(r['n_g'] for r in rows)}건 중 여러 참조 항목이 연결된 결정은 "
              f"{sum(r['multi_ref_captured_decisions'] for r in rows)}건이다. "
              "이는 오류 판정이 아니라 개별 항목의 근거를 확인할 점검 대상이다. 단일 항목 연결도 자동으로 타당성이 보장되지는 않는다.", "",
              "아래 결정 번호는 원본 decisions 배열의 1부터 시작하는 순번이다. "
              f"원문 근거·분류·항목별 연결은 `{PREFIX}-evidence.json`에 보관하였다.", "",
              "| 시행 | Judge | 다중 항목 기여 결정 번호 |",
              "|---|---|---|"]
    for trace in traces:
        indices = trace["multi_ref_decision_indices_1based"]
        if indices:
            lines.append(f"| {trace['run'].removeprefix('runs/')} | {trace['judge']} | "
                         f"{', '.join(map(str, indices))} |")
    lines += ["", "## 공유 및 재현", "",
              "분석 스크립트와 산출물은 analysis/에 두며 runs/의 원본 자료는 수정하지 않는다.", "",
              "실험 저장소 루트에서 실행:", "",
              "```sh", f"python3 analysis/{PREFIX}.py --blocks " + " ".join(map(str, args.blocks)) +
              " --judges " + " ".join(args.judges), "```", "",
              "다른 위치의 입력과 출력은 --experiment-root와 --output-dir로 지정할 수 있다. "
              "표준 라이브러리만 사용하며 API 호출이나 인증 정보가 필요하지 않다. "
              "원본 파일 해시와 선택 범위는 evidence.json에 기록된다.", "",
              "연결 점검에서 문제가 발견되면 별도 기록하고 검토한다. "
              "원본 판정이나 이번 원자료 기반 집계에 자동으로 교정을 적용하지 않는다.", ""]
    (out / f"{PREFIX}-report.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"Reaggregated {len(trials)} trials / {len(rows)} trial-Judge records; sources unchanged.")
    print(f"Report: {out / (PREFIX + '-report.md')}")


if __name__ == "__main__":
    main()
