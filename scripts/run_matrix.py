"""Run a sequential condition matrix, optionally restricted to one model pair."""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import random
import shutil
import subprocess
from datetime import datetime, timezone

import broker
import harness
import llm
import presentation_retry
import measurement
import resource_report
import termination


def now():
    return datetime.now(timezone.utc).isoformat()


def schedule(seed=42, maker=None, director=None):
    rows = [{"condition": cid, "maker": m, "director": d, "status": "pending"}
            for cid in harness.load_conditions()
            for m in ([maker] if maker else ("claude", "codex"))
            for d in ([director] if director else ("claude", "codex"))]
    random.Random(seed).shuffle(rows)
    return [dict(row, index=i) for i, row in enumerate(rows, 1)]


def save(path, state):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(path)


def inputs():
    result = {}
    for name in ("config", "method-configs", "director-configs", "judge-configs", "docker", "oracle", "scripts"):
        for p in sorted((harness.ROOT / name).rglob("*")):
            if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc":
                result[str(p.relative_to(harness.ROOT))] = hashlib.sha256(p.read_bytes()).hexdigest()
    return result


def configure(root):
    for key, name in {"WORK": "_work", "MAKER_WS": "_work/maker-workspace",
                      "MAKER_TS": "_work/maker-transcript", "DIRECTOR_WS": "_work/director-workspace",
                      "DIRECTOR_TS": "_work/director-transcript", "PRESENTATION": "_work/presentation",
                      "SESSION": "_work/session", "RUNS": "runs"}.items():
        setattr(harness, key, root / name)


def active_roles():
    names = subprocess.check_output(["docker", "ps", "-a", "--format", "{{.Names}}"], text=True).splitlines()
    return set(names) & {harness.MAKER, harness.DIRECTOR}


def execute(root, resume=False, maker_provider=None, director_provider=None, max_rounds=None, validation=False):
    if max_rounds is not None and max_rounds < 1:
        raise ValueError('max_rounds must be positive')
    root.mkdir(parents=True, exist_ok=True)
    # All matrix blocks share container names and must not overlap.
    with (harness.ROOT / ".matrix.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        configure(root)
        path = root / "status.json"
        fingerprint = inputs()
        if path.exists():
            state = json.loads(path.read_text())
            if state["inputs"] != fingerprint:
                raise RuntimeError("Inputs changed since this block started; inspect before continuing")
            if ((max_rounds is not None and max_rounds != state['max_rounds']) or
                    (maker_provider and any(r['maker'] != maker_provider for r in state['trials'])) or
                    (director_provider and any(r['director'] != director_provider for r in state['trials']))):
                raise RuntimeError('Requested settings differ from the saved batch')
        else:
            if resume:
                raise RuntimeError("No existing block to resume")
            if active_roles():
                raise RuntimeError("Existing role containers must be inspected before starting a block")
            image = subprocess.check_output(["docker", "image", "inspect", harness.IMAGE,
                                            "--format", "{{.Id}}"], text=True).strip()
            state = {"started_at": now(), "status": "prepared", "seed": 42, "max_rounds": max_rounds or 80,
                     "validation_run": validation, "excluded_from_research_runs": validation,
                     "judges_included": False, "image_id": image, "inputs": fingerprint,
                     "models": {role: {p: llm.select(role, p).metadata() for p in ("claude", "codex")}
                                for role in ("maker", "director")},
                     "trials": schedule(maker=maker_provider, director=director_provider)}
            for rel in fingerprint:
                target = root / "inputs" / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(harness.ROOT / rel, target)
            save(path, state)
        harness.IMAGE = state["image_id"]  # Pin the actual image, not a mutable tag.
        for row in state["trials"]:
            if row["status"] in termination.TERMINAL_STATUSES:
                continue
            pending = presentation_retry.checkpoint_path().exists()
            if row["status"] != "pending" and not (resume and pending):
                raise RuntimeError("Interrupted/failed trial requires inspection; it will not be rerun automatically")
            if pending and not resume:
                raise RuntimeError("Unfinished presentation; inspect the interruption policy before continuing")
            if not pending and active_roles():
                raise RuntimeError("Existing role containers will not be overwritten")
            if inputs() != state["inputs"]:
                raise RuntimeError("Experiment inputs changed; stopping before the next trial")
            maker, director = llm.select("maker", row["maker"]), llm.select("director", row["director"])
            state["status"] = "running"
            row.update(status="running", started_at=row.get("started_at", now()))
            save(path, state)
            timing_dir = root / 'timing' / f"trial-{row['index']:03d}"
            print(f"[matrix] {row['index']}/{len(state['trials'])} {row['condition']} maker={row['maker']} director={row['director']}", flush=True)
            try:
                if pending:
                    checkpoint = presentation_retry.load_checkpoint()
                    if (checkpoint["condition"] != row["condition"] or
                            checkpoint["maker"] != maker.metadata() or checkpoint["director"] != director.metadata()):
                        raise RuntimeError("Checkpoint does not match the scheduled trial")
                    summary = broker.resume_session()
                    resume = False
                else:
                    with measurement.span(timing_dir, 'setup', condition=row['condition']):
                        row["run"] = harness.setup(row["condition"], maker, director)
                    save(path, state)
                    with measurement.span(timing_dir, 'dialogue', condition=row['condition']):
                        summary = broker.run_session(row["condition"], harness.condition_spec(row["condition"])["method"],
                                                     row["run"], state["max_rounds"], maker, director)
                    row.update(status="archiving", summary=summary)
                    save(path, state)
                    with measurement.span(timing_dir, 'archive', condition=row['condition']):
                        harness.teardown()
                row.update(status=termination.outcome(summary),
                           finished_at=now(), summary=summary)
                row.pop("error", None)
                save(path, state)
            except BaseException as exc:
                paused = presentation_retry.checkpoint_path().exists()
                status = "paused" if paused else "archive_failed" if row["status"] == "archiving" else "failed"
                row.update(status=status, error=f"{type(exc).__name__}: {exc}", stopped_at=now())
                state.update(status=row["status"], stopped_at=now())
                save(path, state)
                try:
                    resource_report.write_batch(root)
                except Exception as report_error:
                    print(f'[matrix] resource report unavailable: {type(report_error).__name__}', flush=True)
                print("[matrix] stopped; workspace, transcripts and any running containers preserved", flush=True)
                raise
        state.update(status="finished", finished_at=now())
        save(path, state)
        resource_report.write_batch(root)
        counts = {status: sum(r['status'] == status for r in state['trials'])
                  for status in sorted(termination.TERMINAL_STATUSES)}
        print(f"[matrix] all {len(state['trials'])} attempts finished: {counts}; review validity before analysis", flush=True)


def recover_archive(root):
    """Finish only a completed dialogue's archive, without replay or cleanup."""
    with (harness.ROOT / '.matrix.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        configure(root)
        path = root / 'status.json'
        state = json.loads(path.read_text())
        if presentation_retry.checkpoint_path().exists():
            raise RuntimeError('Presentation is unfinished; archive-only recovery is not applicable')
        summary = json.loads((harness.SESSION / 'usage-summary.json').read_text())
        models = json.loads((harness.SESSION / 'models.json').read_text())
        context = harness._parse_context((harness.SESSION / 'context.md').read_text())
        candidates = [r for r in state['trials'] if r['condition'] == summary['condition']
                      and r.get('run') == summary['run'] and r['status'] in ('failed', 'archive_failed', 'archiving')]
        if len(candidates) != 1:
            raise RuntimeError('No unique unfinished archive matches this completed dialogue')
        row = candidates[0]
        expected = {role: state['models'][role][row[role]] for role in ('maker', 'director')}
        if (models != expected or context['condition'] != summary['condition'] or
                int(context['run']) != summary['run'] or
                (harness.SESSION / 'image-id.txt').read_text().strip() != state['image_id']):
            raise RuntimeError('Saved dialogue metadata does not match this batch')
        if not summary.get('terminated') and not summary.get('hit_max_rounds'):
            raise RuntimeError('Dialogue has no recorded termination')
        # Preserve the prior failure record. Input fingerprints stay unchanged:
        # copying old evidence does not authorize executing old trials with new policies.
        save(root / f"status-before-archive-recovery-{datetime.now().strftime('%Y%m%dT%H%M%S%f')}.json", state)
        archive = harness.archive_current_run()
        row.update(status=termination.outcome(summary), summary=summary,
                   finished_at=summary['ended_at'], archive_recovered_at=now())
        if 'error' in row:
            row['archive_error_before_recovery'] = row.pop('error')
        state.update(status='stopped_after_archive_recovery')
        save(path, state)
        print(f'[matrix] archive recovered: {archive}; queue not resumed; active workspace retained', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-dir", type=Path, help='separate validation or historical matrix directory')
    blocks = parser.add_mutually_exclusive_group()
    blocks.add_argument('--block', type=int, help='execute one block from the frozen research schedule')
    blocks.add_argument('--judge-block', type=int, help='judge one completed research block')
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--resume-session", action="store_true")
    parser.add_argument("--maker", choices=['claude', 'codex'])
    parser.add_argument("--director", choices=['claude', 'codex'])
    parser.add_argument("--max-rounds", type=int)
    parser.add_argument("--validation", action='store_true', help='mark this batch as verification, excluded from research runs')
    parser.add_argument("--archive-only", action="store_true", help="recover a completed dialogue's archive without model calls")
    args = parser.parse_args()
    if args.block is not None or args.judge_block is not None:
        if args.batch_dir or args.resume_session or args.maker or args.director or args.max_rounds or args.validation or args.archive_only:
            parser.error('Research blocks cannot be combined with historical/validation matrix options')
        import research_execution
        research_execution.execute(args.block if args.block is not None else args.judge_block,
                                   judging=args.judge_block is not None, dry_run=args.dry_run)
        return
    if args.batch_dir is None:
        parser.error('Choose --block, --judge-block, or an explicit --batch-dir')
    if args.archive_only:
        if args.dry_run or args.resume_session or args.maker or args.director or args.max_rounds or args.validation:
            parser.error('--archive-only cannot be combined with other modes')
        recover_archive(args.batch_dir.resolve())
        return
    if args.dry_run:
        print(json.dumps(schedule(maker=args.maker, director=args.director), indent=2))
        return
    if os.environ.get("HARNESS_AUTH_MODE", "subscription") != "subscription":
        raise RuntimeError("This matrix uses VM subscription authentication")
    execute(args.batch_dir.resolve(), args.resume_session, args.maker, args.director, args.max_rounds, args.validation)


if __name__ == "__main__":
    main()
