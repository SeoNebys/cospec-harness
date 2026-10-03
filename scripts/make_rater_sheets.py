#!/usr/bin/env python3
"""Build the blinded rating packages for the three human raters (W3).

Two independent packages are produced:

  co-construction/  layer-2 judgments on decisions sampled from whole sessions
  coverage/         per-REF-BM verdicts on masked implementation workspaces

Blinding rules enforced here:
  - the first rater's answers (caught / catch_type / note, and judgment.json)
    are never written into a rater folder;
  - condition labels and run ids are replaced by opaque codes;
  - the code -> run mapping is written to a separate key directory that is
    NOT part of any rater's package.

Sampling is seeded, so the whole package is reproducible from this file.

Usage:
  python scripts/make_rater_sheets.py --out ../review/round-3/data
"""
from __future__ import annotations

import argparse
import collections
import csv
import json
import random
import shutil
from pathlib import Path

import harness

SEED = 20260902
RATERS = ["H1", "H2", "H3", "H4", "H5"]
CONDITIONS = ["CO-D", "CO-S", "SD-D", "SD-S", "VC"]
PLANNED = [f"run-0{i}" for i in range(1, 6)]

# Runs whose implementation can be started faithfully (see w3-method.md 4.3):
# T1 = no dependencies, T2 = lockfile present so `npm ci` restores run-time versions.
COVERAGE_ELIGIBLE = {
    "CO-D": ["run-01", "run-03", "run-04", "run-05"],
    "CO-S": ["run-01", "run-02", "run-03", "run-04", "run-05"],
    "SD-D": ["run-01", "run-03"],
    "SD-S": ["run-01"],
    "VC":   ["run-01", "run-02", "run-03", "run-04"],
}
COVERAGE_COMMON_CONDS = ["CO-D", "SD-D"]          # judged by every rater
# One assigned run per rater. Every condition appears, and the pair carrying the
# coverage comparison (CO-D vs SD-D) gets a second run.
COVERAGE_ASSIGNED_CONDS = ["CO-S", "SD-S", "VC", "CO-D", "SD-D"]

CALIB_COVERAGE_RUN = ("CO-D", "run-06")   # supplemental run, outside the primary analysis
CALIB_CC_MAX_CHARS = 25_000               # keep the practice transcript short
CALIB_CC_ITEMS = 5
CALIB_COV_ITEMS = 8

CORE = [f"REF-BM-{i:02d}" for i in range(1, 23)]
EXTENDED = [f"REF-BM-{i:02d}" for i in range(23, 33)]


# --------------------------------------------------------------------------- #
# reading the archive
# --------------------------------------------------------------------------- #
def ref_spec_items() -> dict[str, str]:
    """REF-BM-### -> its one-line requirement text."""
    out = {}
    for line in (harness.ORACLE / "reference-spec.md").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("- REF-BM-") and ":" in line:
            key, text = line[2:].split(":", 1)
            out[key.strip()] = text.strip()
    return out


def transcript(run: Path) -> list[dict]:
    log = json.loads((run / "broker-log.json").read_text(encoding="utf-8"))
    return [e for e in log if e.get("role") in ("system", "maker", "client")]


def transcript_chars(run: Path) -> int:
    return sum(len(e.get("content") or "") for e in transcript(run)
               if e.get("role") in ("maker", "client"))


def unique_key_decisions(run: Path) -> list[dict]:
    """Decisions whose touched-REF-item set is unique inside the session.

    Only these can be re-judged 1:1 without telling the rater which of several
    same-item decisions is meant, so the human sample is drawn from them.
    """
    data = json.loads((run / "ng-judgment.json").read_text(encoding="utf-8"))
    decisions = data.get("decisions") or []
    keys = [tuple(sorted(d.get("ref_items") or [])) for d in decisions]
    counts = collections.Counter(keys)
    return [{"ref_items": list(k)} for k, d in zip(keys, decisions)
            if counts[k] == 1 and k]


# --------------------------------------------------------------------------- #
# rendering
# --------------------------------------------------------------------------- #
def render_transcript(run: Path, code: str) -> str:
    lines = [f"# 세션 {code}", ""]
    entries = transcript(run)
    initial = next((e for e in entries if e.get("role") == "system"), None)
    if initial:
        lines += ["**공통 초기 프롬프트**", "", f"> {initial['content'].strip()}", ""]
    lines += ["---", ""]
    for e in entries:
        if e.get("role") == "system":
            continue
        who = "제작자 (maker)" if e["role"] == "maker" else "클라이언트 (client)"
        lines.append(f"## 라운드 {e.get('round')} — {who}")
        arts = e.get("artifacts") or []
        if arts:
            lines.append("")
            lines.append(f"*이 라운드에 제시된 산출물: {', '.join(arts)}*")
        lines += ["", (e.get("content") or "").strip(), ""]
    return "\n".join(lines) + "\n"


def render_cc_items(items: list[dict], spec: dict[str, str], title: str) -> str:
    lines = [f"# {title}", "",
             "각 항목은 하나의 **결정**이다. 해당 세션 대화록 전체를 읽고, 그 결정에",
             "대해 판정한다. 기록은 `answers.csv`에 한다.", "",
             "판정 기준은 패킷 루트의 `rubric-co-construction.md`이다.",
             "`q7_response_class`에는 corrective / accepted_divergence / "
             "unexpressed_divergence / unresolved / not_divergent 중 하나를 기록한다.",
             "`q3_caught`는 불일치를 드러내고 조정하거나 수용하는 판단을 표현했는지이다. "
             "corrective와 accepted_divergence는 모두 caught=true이다. "
             "차이 수용은 catch_type=none으로 기록한다.",
             "차이 수용은 클라이언트가 기대나 차이를 명시적으로 표현하고 수용한 경우이다. "
             "Maker가 차이를 설명했더라도 단순히 ‘네’라고 답한 것만으로는 인정하지 않는다. "
             "응답 길이보다 해당 차이를 표현했는지를 판단한다.",
             "차이 언급 없는 승인은 인식 실패로 단정하지 않는다. 설명 요청이나 "
             "근거 부족으로 판단이 끝나지 않으면 unresolved로 기록한다.",
             "기대를 표현했어도 판단이 보류된 경우에는 unresolved이며, "
             "표현된 기대를 q8_evidence에 남긴다.",
             "불일치 자체를 판단할 수 없으면 q2_diverged에 unknown을 기록한다.",
             "`q8_evidence`에 제시·응답의 라운드와 발췌문을 기록한다. "
             "같은 미결정 사항의 확인 질문과 후속 판단을 중복 집계하지 않는다. "
             "한 응답에서 분리 가능한 요구별로 수정과 수용이 섞이면 각각 판단하며, "
             "같은 결정을 수정과 수용 양쪽에 중복 집계하지 않는다.", ""]
    by_session: dict[str, list[dict]] = collections.defaultdict(list)
    for it in items:
        by_session[it["session"]].append(it)
    for session in sorted(by_session):
        lines += ["---", "", f"## 세션 {session}",
                  f"대화록: `transcripts/{session}.md`", ""]
        for it in by_session[session]:
            lines.append(f"### {it['item_id']}")
            lines.append("")
            lines.append("| 참조명세 항목 | 요구 내용 |")
            lines.append("|---|---|")
            for r in it["ref_items"]:
                lines.append(f"| `{r}` | {spec.get(r, '(참조명세에서 찾지 못함)')} |")
            lines.append("")
    return "\n".join(lines) + "\n"


CC_HEADER = ["item_id", "session", "ref_items",
             "q1_scope", "q2_diverged", "q3_caught", "q4_catch_type",
             "q5_confidence", "q6_note", "q7_response_class", "q8_evidence"]
COV_HEADER = ["workspace", "ref_item", "section", "requirement",
              "verdict", "basis", "evidence", "confidence", "note"]


def write_cc_answers(path: Path, items: list[dict], rater: str) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([f"# rater={rater}"] + [""] * (len(CC_HEADER) - 1))
        w.writerow(CC_HEADER)
        for it in items:
            w.writerow([it["item_id"], it["session"], " ".join(it["ref_items"]),
                        *([""] * (len(CC_HEADER) - 3))])


def write_cov_answers(path: Path, ws_code: str, spec: dict[str, str], rater: str) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([f"# rater={rater}", f"# workspace={ws_code}"] + [""] * (len(COV_HEADER) - 2))
        w.writerow(COV_HEADER)
        for item in CORE + EXTENDED:
            section = "core" if item in CORE else "extended"
            w.writerow([ws_code, item, section, spec.get(item, ""), "", "", "", "", ""])


EXCLUDE_DIRS = {"prototypes", "presentation", "specs", ".specify", ".claude",
                "context", "node_modules", "tests", "test", "e2e", "__tests__",
                "coverage", "docs"}


def _entry_htmls(run: Path) -> list[Path]:
    """Candidate entry points of the shipped implementation.

    Prototypes, presentation snapshots, spec folders and working documents are
    not the deliverable, so they are never offered as an entry point.
    """
    out = []
    for p in sorted(run.rglob("*.html")):
        rel = p.relative_to(run)
        if EXCLUDE_DIRS & set(rel.parts[:-1]):
            continue
        out.append(rel)
    out.sort(key=lambda r: (len(r.parts), r.name != "index.html", r.as_posix()))
    return out


def how_to_run(run: Path, ws_code: str) -> str:
    """Per-workspace start-up instructions, derived from what the archive holds."""
    pkgs = [p for p in sorted(run.rglob("package.json"))
            if not (EXCLUDE_DIRS & set(p.relative_to(run).parts[:-1]))]
    deps: dict[str, str] = {}
    scripts: dict[str, str] = {}
    roots: list[Path] = []
    per_root: dict[str, dict[str, str]] = {}
    for p in pkgs:
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        deps.update(d.get("dependencies") or {})
        deps.update(d.get("devDependencies") or {})
        sc = d.get("scripts") or {}
        scripts.update(sc)
        rel = p.parent.relative_to(run)
        roots.append(rel)
        per_root[rel.as_posix()] = sc
    htmls = _entry_htmls(run)
    lines = [f"# {ws_code} 기동 방법", ""]
    if not deps:
        lines += ["의존성이 없다. 정적 파일만으로 동작한다.", "",
                  "```bash",
                  f"cd {ws_code}",
                  "python3 -m http.server 8000",
                  "```", "",
                  "브라우저에서 다음 파일을 연다:", ""]
        if htmls:
            lines += [f"- `{h}` → <http://localhost:8000/{h.as_posix()}>" for h in htmls[:10]]
        else:
            lines.append("- 구현 진입점을 자동으로 찾지 못했다. 파일 트리에서 직접 찾는다.")
        lines += ["", "브라우저 확장으로 만들어진 경우 정적 서버로는 일부 기능이 동작하지",
                  "않을 수 있다. 그런 항목은 `basis`를 `code`로 남긴다."]
    else:
        lines += ["`node_modules`는 아카이브에 포함되지 않았다. **lockfile 기반으로**",
                  "설치해야 실행 당시 버전이 복원된다 — `npm install`이 아니라 `npm ci`를 쓴다.", "",
                  "```bash", f"cd {ws_code}"]
        for r in roots:
            rp = r.as_posix()
            lines.append("npm ci" if rp == "." else f"(cd {rp} && npm ci)")
        for name in ("start", "dev", "preview", "build"):
            hit = next((rp for rp in sorted(per_root, key=len) if name in per_root[rp]), None)
            if hit:
                cmd = f"npm run {name}"
                lines.append(f"{cmd}   # {per_root[hit][name]}" if hit == "."
                             else f"(cd {hit} && {cmd})   # {per_root[hit][name]}")
                break
        lines += ["```", "",
                  f"선언된 스크립트: {', '.join(sorted(scripts)) or '없음'}", "",
                  "설치나 기동이 실패하면 **그 사실을 `note`에 적고 코드 독해로 판정한다.**",
                  "실패한 항목의 `basis`는 `code`로 남긴다."]
    lines += ["", "---", "",
              "기동에 성공했다면 판정 근거로 실행 결과를 쓸 수 있다. `basis` 열에",
              "`code` / `run` / `both` 중 하나를 반드시 기록한다.", "",
              "**판정 근거가 아닌 것**: `prototypes/`, `presentation/`, `specs/`,",
              "`.specify/`, `.claude/`, `context/`, 문서·주석·TODO. 루브릭이 명시한다 —",
              "동작하는 구현 코드와 그 동작만으로 판정한다."]
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------- #
# build
# --------------------------------------------------------------------------- #
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, required=True, help="package root (data/)")
    args = ap.parse_args()

    rng = random.Random(SEED)
    spec = ref_spec_items()
    out = args.out.resolve()
    cc_root, cov_root, key_root = out / "co-construction", out / "coverage", out / "_key"
    # Regenerate the rater folders but keep the hand-written README.md of each
    # metric directory — it is the judging instruction, not a generated file.
    for d in (cc_root, cov_root, key_root):
        d.mkdir(parents=True, exist_ok=True)
        for child in d.iterdir():
            if child.name == "README.md":
                continue
            shutil.rmtree(child) if child.is_dir() else child.unlink()

    # ---- 1. coverage runs: pick from the eligible (startable) runs -------- #
    if len(COVERAGE_ASSIGNED_CONDS) != len(RATERS):
        raise SystemExit("one assigned run per rater is required")
    cov_runs: dict[str, list[str]] = {}
    for c in CONDITIONS:
        need = COVERAGE_COMMON_CONDS.count(c) + COVERAGE_ASSIGNED_CONDS.count(c)
        pool = list(COVERAGE_ELIGIBLE[c])
        if need > len(pool):
            raise SystemExit(f"{c}: need {need} startable runs, only {len(pool)} exist")
        rng.shuffle(pool)
        cov_runs[c] = pool[:need]

    common = [(c, cov_runs[c][0]) for c in COVERAGE_COMMON_CONDS]
    taken = collections.Counter(c for c, _ in common)
    assigned = []
    for c in COVERAGE_ASSIGNED_CONDS:
        assigned.append((c, cov_runs[c][taken[c]]))
        taken[c] += 1
    rng.shuffle(assigned)
    assignment = dict(zip(RATERS, assigned))          # rater -> (cond, run)

    ws_code = {}
    for c in CONDITIONS:
        for r in cov_runs[c]:
            ws_code[(c, r)] = "WS-" + f"{rng.randrange(16**4):04X}"
    ws_code[CALIB_COVERAGE_RUN] = "WS-CAL"

    # ---- 2. co-construction runs: one per condition, disjoint from coverage #
    cc_pick = {}
    for c in CONDITIONS:
        pool = [r for r in PLANNED if r not in cov_runs[c]]
        cc_pick[c] = rng.choice(pool)

    # calibration session: a leftover run, small transcript, enough decisions
    used = {(c, cc_pick[c]) for c in CONDITIONS} | set(ws_code)
    leftovers = [(c, r) for c in CONDITIONS for r in PLANNED if (c, r) not in used]
    calib_pool = [t for t in leftovers
                  if transcript_chars(harness.RUNS / t[0] / t[1]) <= CALIB_CC_MAX_CHARS
                  and len(unique_key_decisions(harness.RUNS / t[0] / t[1])) >= CALIB_CC_ITEMS]
    calib_cc = rng.choice(calib_pool)

    # ---- 3. co-construction items ---------------------------------------- #
    sessions = [(c, cc_pick[c]) for c in CONDITIONS]
    rng.shuffle(sessions)
    session_code = {t: f"S{i+1}" for i, t in enumerate(sessions)}
    session_code[calib_cc] = "SC"

    items: list[dict] = []
    for cond, run in sessions:
        rp = harness.RUNS / cond / run
        decs = unique_key_decisions(rp)
        rng.shuffle(decs)
        for d in decs:
            items.append({"session": session_code[(cond, run)],
                          "ref_items": d["ref_items"],
                          "_run": f"{cond}/{run}"})
    for i, it in enumerate(items, start=1):
        it["item_id"] = f"CC-{i:03d}"

    calib_decs = unique_key_decisions(harness.RUNS / calib_cc[0] / calib_cc[1])
    rng.shuffle(calib_decs)
    calib_items = [{"session": "SC", "ref_items": d["ref_items"],
                    "item_id": f"CAL-{i:02d}", "_run": f"{calib_cc[0]}/{calib_cc[1]}"}
                   for i, d in enumerate(calib_decs[:CALIB_CC_ITEMS], start=1)]

    # ---- 4. coverage calibration items ----------------------------------- #
    calib_run = harness.RUNS / CALIB_COVERAGE_RUN[0] / CALIB_COVERAGE_RUN[1]
    verdicts = json.loads((calib_run / "judgment.json").read_text(encoding="utf-8"))
    by_verdict: dict[str, list[str]] = collections.defaultdict(list)
    for sect in ("core", "extended"):
        for item, v in (verdicts.get(sect) or {}).items():
            by_verdict[v].append(item)
    calib_cov: list[str] = []
    for v, k in (("partial", 3), ("present", 3), ("absent", 2)):
        pool = sorted(by_verdict.get(v, []))
        rng.shuffle(pool)
        calib_cov += pool[:k]
    calib_cov = sorted(set(calib_cov))[:CALIB_COV_ITEMS]

    # ---- 5. write the co-construction packages --------------------------- #
    for rater in RATERS:
        base = cc_root / rater
        (base / "transcripts").mkdir(parents=True)
        shutil.copy(harness.ORACLE / "reference-spec.md", base / "reference-spec.md")
        shutil.copy(harness.ORACLE / "rubrics" / "co-construction.md",
                    base / "rubric-co-construction.md")
        for cond, run in sessions:
            code = session_code[(cond, run)]
            (base / "transcripts" / f"{code}.md").write_text(
                render_transcript(harness.RUNS / cond / run, code), encoding="utf-8")
        (base / "items.md").write_text(
            render_cc_items(items, spec, "공동구축 판정 항목"), encoding="utf-8")
        write_cc_answers(base / "answers.csv", items, rater)

        cal = base / "calibration"
        (cal / "transcripts").mkdir(parents=True)
        (cal / "transcripts" / "SC.md").write_text(
            render_transcript(harness.RUNS / calib_cc[0] / calib_cc[1], "SC"), encoding="utf-8")
        (cal / "items.md").write_text(
            render_cc_items(calib_items, spec, "연습 항목 (κ 계산에서 제외)"), encoding="utf-8")
        write_cc_answers(cal / "answers.csv", calib_items, rater)

    # ---- 6. write the coverage packages ---------------------------------- #
    for rater in RATERS:
        base = cov_root / rater
        (base / "workspaces").mkdir(parents=True)
        shutil.copy(harness.ORACLE / "reference-spec.md", base / "reference-spec.md")
        shutil.copy(harness.ORACLE / "rubrics" / "coverage.md", base / "rubric-coverage.md")

        mine = common + [assignment[rater]]
        howto = ["# 담당 워크스페이스와 기동 방법", "",
                 f"{rater}가 판정할 워크스페이스는 {len(mine)}개다. 각 워크스페이스마다",
                 "참조명세 32항목 전부를 판정한다 (`answers-<코드>.csv`).", ""]
        for cond, run in mine:
            code = ws_code[(cond, run)]
            src = harness.RUNS / cond / run / "maker-workspace"
            shutil.copytree(src, base / "workspaces" / code)
            write_cov_answers(base / f"answers-{code}.csv", code, spec, rater)
            howto += ["---", "", how_to_run(src, code)]
        (base / "HOW-TO-RUN.md").write_text("\n".join(howto) + "\n", encoding="utf-8")

        cal = base / "calibration"
        cal.mkdir()
        shutil.copytree(calib_run / "maker-workspace", cal / "workspaces" / "WS-CAL")
        (cal / "HOW-TO-RUN.md").write_text(
            how_to_run(calib_run / "maker-workspace", "WS-CAL"), encoding="utf-8")
        with (cal / "answers.csv").open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow([f"# rater={rater}", "# workspace=WS-CAL"] + [""] * (len(COV_HEADER) - 2))
            w.writerow(COV_HEADER)
            for item in calib_cov:
                section = "core" if item in CORE else "extended"
                w.writerow(["WS-CAL", item, section, spec.get(item, ""), "", "", "", "", ""])
        (cal / "items.md").write_text(
            "# 연습 항목 (κ 계산에서 제외)\n\n"
            f"워크스페이스 `WS-CAL`에서 아래 {len(calib_cov)}개 항목만 판정한다.\n"
            "`partial` 경계 판단을 맞추기 위한 연습이다.\n\n"
            + "\n".join(f"- `{i}` — {spec.get(i,'')}" for i in calib_cov) + "\n",
            encoding="utf-8")

    # ---- 7. the key (never distributed) ---------------------------------- #
    key = {
        "seed": SEED,
        "generated_by": "scripts/make_rater_sheets.py",
        "co_construction": {
            "session_to_run": {session_code[t]: f"{t[0]}/{t[1]}" for t in sessions},
            "calibration_session": {"SC": f"{calib_cc[0]}/{calib_cc[1]}"},
            "items": {it["item_id"]: {"run": it["_run"], "ref_items": it["ref_items"],
                                      "session": it["session"]} for it in items},
            "calibration_items": {it["item_id"]: {"run": it["_run"],
                                                  "ref_items": it["ref_items"]}
                                  for it in calib_items},
            "n_items": len(items),
        },
        "coverage": {
            "workspace_to_run": {v: f"{k[0]}/{k[1]}" for k, v in ws_code.items()},
            "common": [f"{c}/{r}" for c, r in common],
            "assigned": {rater: f"{c}/{r}" for rater, (c, r) in assignment.items()},
            "calibration_items": calib_cov,
        },
    }
    (key_root / "rater-key.json").write_text(
        json.dumps(key, ensure_ascii=False, indent=2), encoding="utf-8")
    (key_root / "README.md").write_text(
        "# 배포 금지\n\n"
        "이 디렉터리는 익명 코드와 원본 런의 매핑이다. **판정자에게 전달하지 않는다.**\n"
        "판정 회수가 끝난 뒤 집계 단계에서만 사용한다.\n", encoding="utf-8")

    # ---- 8. summary ------------------------------------------------------ #
    print(f"seed = {SEED}")
    print("\n[공동구축] 세션 (조건별 1런, 커버리지 런과 배타)")
    for cond, run in sessions:
        rp = harness.RUNS / cond / run
        n = len(unique_key_decisions(rp))
        print(f"  {session_code[(cond,run)]}  {cond}/{run:<7} 항목 {n:>2}  "
              f"대화 {transcript_chars(rp):>7,}자")
    print(f"  → {len(RATERS)}인 공통 판정 항목 {len(items)}건, "
          f"총 대화 {sum(transcript_chars(harness.RUNS/c/r) for c,r in sessions):,}자")
    print(f"  연습 세션 SC = {calib_cc[0]}/{calib_cc[1]} ({CALIB_CC_ITEMS}건)")
    print("\n[커버리지] 워크스페이스")
    for cond, run in common:
        print(f"  {ws_code[(cond,run)]}  {cond}/{run:<7} 공통 ({len(RATERS)}인 전원)")
    for rater, (cond, run) in assignment.items():
        print(f"  {ws_code[(cond,run)]}  {cond}/{run:<7} 분담 → {rater}")
    print(f"  → 1인당 {len(common)+1}런 × 32항목 = {(len(common)+1)*32}건")
    print(f"  연습 WS-CAL = {'/'.join(CALIB_COVERAGE_RUN)}, 항목 {calib_cov}")


if __name__ == "__main__":
    main()
