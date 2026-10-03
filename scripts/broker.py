#!/usr/bin/env python3
"""Broker — the batch runner and in-session relay.

The broker is deliberately NON-AGENTIC: it passes the director's dialogue to
the maker verbatim, storing a trailing final-acceptance control tag separately
for new trials. It never composes or paraphrases reaction content.
Its jobs are (1) expand the run-plan into an ordered schedule,
(2) per run: setup -> session loop -> teardown, (3) curate the presentation
surface the director may see, (4) log every utterance.

Usage:
  python scripts/broker.py                 # run per config/run-plan.yaml
  python scripts/broker.py CO-D            # single ad-hoc run of one condition
  python scripts/broker.py CO-D --trials 3 # run one condition N times
  python scripts/broker.py --max-rounds 20 # override the safety cap

Auth/model: VM subscription credentials; config/llm.yaml fixes model and effort.
Use --maker/--director to select a provider pair.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import shutil
import subprocess
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

import yaml

import harness
import llm
import app_presentation
import presentation_retry
import measurement
import termination
from render_preview import render_html

# Windows consoles default to cp949; force UTF-8 so progress prints never crash
# on non-ASCII (em-dash, Korean, etc.).
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

STALL_ROUNDS = int(os.environ.get("HARNESS_STALL_ROUNDS", "3"))


def _ask(container: str, model: llm.Model, prompt: str, session_id: str | None) -> dict:
    return llm.invoke(container, model, prompt, session_id,
                      record_dir=harness.SESSION / "calls" / container)


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
      cospec -> prototype directory, including runtime assets, plus rendered PNG.
                NEVER context/ (scenarios,
                Gherkin) or .claude/ — COSPEC does not expose the spec to the client.
      sdd    -> the spec documents presented at the gate (specs/**/*.md).
      vibe   -> the running app, rendered to PNG.
    Returns container-relative paths (/presentation/...) for the director prompt.
    """
    dest = harness.PRESENTATION / f"round-{round_no:02d}"
    dest.mkdir(parents=True, exist_ok=True)
    ws = harness.MAKER_WS
    refs: list[str] = []

    if method == "cospec":
        proto = ws / "prototypes"
        if proto.exists():
            # Keep relative script/style/image references intact. Refuse links
            # rather than copying files from outside the presentation boundary.
            if proto.is_symlink() or any(p.is_symlink() for p in proto.rglob("*")):
                raise ValueError("Prototype presentation cannot contain symbolic links")
            shutil.copytree(proto, dest, dirs_exist_ok=True)
            # Maker screenshots can show a post-action state that a fresh
            # file:// rendering cannot reproduce. List every copied image,
            # including images without a corresponding HTML filename.
            for asset in sorted(proto.rglob("*")):
                if asset.is_file() and asset.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}:
                    refs.append(f"/presentation/round-{round_no:02d}/{asset.relative_to(proto).as_posix()}")
            for html in sorted(proto.rglob("*.html")):
                out = dest / html.relative_to(proto)
                refs.append(f"/presentation/round-{round_no:02d}/{out.relative_to(dest).as_posix()}")
                png = out.with_suffix(".png")
                # A prototype may already use that PNG name as an image asset.
                while png.exists():
                    png = png.with_name(png.stem + ".preview.png")
                if render_html(out, png):
                    refs.append(f"/presentation/round-{round_no:02d}/{png.relative_to(dest).as_posix()}")
    elif method == "sdd":
        specs = ws / "specs"
        if specs.exists():
            for md in sorted(specs.rglob("*.md")):
                rel = md.relative_to(specs)
                out = dest / str(rel).replace(os.sep, "__")
                out.write_text(md.read_text(encoding="utf-8", errors="replace"), encoding="utf-8")
                refs.append(f"/presentation/round-{round_no:02d}/{out.name}")
    # Runnable implementations use HTTP even when their entry point is HTML.
    # With no declared endpoint (e.g. early clarification), no live UI is claimed.
    refs.extend(app_presentation.present(ws, dest, round_no))
    return refs


def director_prompt(maker_text: str, refs: list[str], round_no: int, provider: str = "claude") -> str:
    listing = "\n".join(f"  - {r}" for r in refs) or "  (no artifacts presented this round)"
    return (
        f"# Round {round_no}\n\n"
        "The maker (who cannot see the reference spec) just said:\n"
        f"<<<MAKER\n{maker_text}\nMAKER\n\n"
        "Artifacts the maker presented this round (read them if useful):\n"
        f"{listing}\n\n"
        "Any HTTP URL in this list is the running app address reachable from "
        "your container. screen.txt is the visible text captured with screen.png; "
        "it does not demonstrate interactions beyond that captured screen.\n\n"
        "Maker paths under /work/prototypes/ refer to the copied files at "
        f"/presentation/round-{round_no:02d}/ with the same relative path. "
        "The Maker's /work is not your /work. Maker-supplied images may show "
        "a different state from newly rendered HTML previews; use the file "
        "named in the current guidance and report any mismatch.\n\n"
        "Your ground truth is /oracle/reference-spec.md. Follow the engagement "
        f"policy in ./{harness.policy_filename(provider)}.\n\n"
        + ("Reply with the client's next utterance. Do not describe your reasoning. "
           "Only when accepting the complete implemented application, append "
           "<FINAL_ACCEPTED> on its own final line. Never append it to approval of "
           "a specification, plan, prototype or individual feature. The tag is "
           "control metadata, not dialogue." if termination.enabled(harness.SESSION)
           else "Reply with ONLY the client's next utterance. Do not describe your reasoning.")
    )


def _maker_converged(provider: str = "claude") -> bool:
    """Convergence is owned by the maker's cycle, not the director: the session
    ends when the maker has delivered an implementation and marked its own cycle
    complete (Phase 4 accepted / idle). Detected from the maker's workspace —
    never from a client declaration. Requires implementation/ to exist, so the
    run cannot 'converge' on prototypes alone."""
    ws = harness.MAKER_WS
    if not (ws / "implementation").exists():
        return False
    claude_md = ws / harness.policy_filename(provider)
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
        if os.path.relpath(root, ws) == '.harness':
            dirs[:] = [d for d in dirs if d != 'runtime']
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
    """Observed consumption, including recorded failed attempts and child threads.

    CLI usage is not subscription billing. Unknown usage is explicitly marked.
    """
    attempts = {}
    for role, container in (('maker', harness.MAKER), ('client', harness.DIRECTOR)):
        attempts[role] = [json.loads(p.read_text()) for p in
                         (harness.SESSION / 'calls' / container / 'attempts').glob('*.json')]
    def tok(role: str, k: str) -> int:
        if attempts[role]:
            return sum(e.get('accounting', {}).get('usage', {}).get(k, 0) for e in attempts[role])
        return sum((e.get("usage") or {}).get(k, 0) for e in log if e.get("role") == role)

    def cost(role: str) -> float:
        return round(sum((e.get("cost_usd") or 0.0) for e in log if e.get("role") == role), 4)

    def block(role: str) -> dict:
        return {"output_tokens": tok(role, "output_tokens"),
                "input_tokens": tok(role, "input_tokens"),
                "cache_read_tokens": tok(role, "cache_read_input_tokens"),
                "cache_creation_tokens": tok(role, "cache_creation_input_tokens"),
                "cost_usd_sum": cost(role),
                "usage_complete": (all(e.get('accounting', {}).get('complete', False)
                                       for e in attempts[role]) if attempts[role] else None),
                "usage_issues": sorted({issue for e in attempts[role]
                                        for issue in e.get('accounting', {}).get('issues', [])}),
                "failed_attempts": sum(e.get('outcome') != 'completed' for e in attempts[role])}

    rounds = max((e["round"] for e in log), default=0)
    return {
        "condition": cid, "run": run_no, "rounds": rounds,
        "terminated": term, "hit_max_rounds": term is None and rounds >= max_rounds,
        "started_at": t0.isoformat(timespec="seconds"),
        "ended_at": t1.isoformat(timespec="seconds"),
        "wall_seconds": int((t1 - t0).total_seconds()),
        "operation_timing": measurement.summarize(harness.SESSION / 'timing'),
        "usage_scope": "all recorded attempts; main and observed child/auxiliary models; no dialogue-tail exclusion",
        "maker": block("maker"), "client": block("client"),
        "total_output_tokens": tok("maker", "output_tokens") + tok("client", "output_tokens"),
        "total_cost_usd_sum": round(cost("maker") + cost("client"), 4),
    }


def run_session(cid: str, method: str, run_no: int, max_rounds: int,
                maker: llm.Model, director: llm.Model, resume: dict | None = None,
                continue_capped: bool = False, continue_failed: dict | None = None,
                presentation_authorization: str | None = None,
                continue_director: dict | None = None) -> dict:
    presentation_retry.limits()  # Validate before starting a model call.
    log_path = harness.SESSION / "broker-log.json"
    explicit_acceptance = termination.enabled(harness.SESSION)
    if continue_director:
        saved = json.loads(log_path.read_text())
        if (resume or continue_capped or continue_failed or presentation_authorization
                or not explicit_acceptance or presentation_retry.checkpoint_path().exists()
                or continue_director.get('authorization') != 'explicit_user_request'
                or continue_director.get('log_sha256') != hashlib.sha256(log_path.read_bytes()).hexdigest()
                or (continue_director.get('condition'), continue_director.get('method'),
                    continue_director.get('run'), continue_director.get('max_rounds')) != (cid, method, run_no, max_rounds)
                or len(saved) < 2 or saved[-1].get('role') != 'maker'
                or saved[-1].get('round') != continue_director.get('round')
                or saved[-1].get('session_id') != continue_director.get('maker_session')
                or saved[-2].get('role') != 'client'
                or saved[-2].get('round') != continue_director['round'] - 1
                or saved[-2].get('session_id') != continue_director.get('director_session')
                or 'presentation_error' in saved[-1]
                or not isinstance(saved[-1].get('artifacts'), list)
                or json.loads((harness.SESSION / 'models.json').read_text()) !=
                   {'maker': maker.metadata(), 'director': director.metadata()}):
            raise RuntimeError('Manual Director continuation requires unchanged dialogue, models and role sessions')
        resume = continue_director
    if presentation_authorization is not None:
        if (presentation_authorization != 'explicit_user_request' or not resume
                or resume != presentation_retry.load_checkpoint()
                or resume.get('state') != 'paused'
                or (resume.get('condition'), resume.get('method'), resume.get('run'), resume.get('max_rounds'))
                   != (cid, method, run_no, max_rounds)
                or resume.get('maker') != maker.metadata()
                or resume.get('director') != director.metadata()
                or json.loads((harness.SESSION / 'models.json').read_text()) !=
                   {'maker': maker.metadata(), 'director': director.metadata()}):
            raise RuntimeError('Manual presentation continuation requires an intact checkpoint and unchanged models')
        saved = json.loads(log_path.read_text())
        if (len(saved) < 2 or saved[-1].get('role') != 'maker'
                or saved[-1].get('round') != resume['round']
                or saved[-1].get('session_id') != resume['maker_session']
                or saved[-2].get('role') != 'client'
                or saved[-2].get('round') != resume['round'] - 1
                or saved[-2].get('session_id') != resume['director_session']):
            raise RuntimeError('Manual presentation continuation requires the saved role sessions')
    if resume and termination.stop_on_interruption(harness.SESSION) and presentation_authorization is None and not continue_director:
        raise RuntimeError('Interrupted trial cannot resume; preserve it and use a separate trial for any rerun')
    if resume is None and presentation_retry.checkpoint_path().exists():
        raise presentation_retry.PresentationPaused("Unfinished presentation exists; inspect the interruption policy before continuing")
    if resume and continue_capped:
        raise RuntimeError('A cap extension cannot replay an interrupted presentation')
    if continue_failed and (resume or continue_capped):
        raise RuntimeError('Manual call continuation cannot be combined with another resume mode')
    log: list[dict] = json.loads(log_path.read_text()) if resume or continue_capped or continue_failed else []
    extension = None
    if continue_failed:
        if (not explicit_acceptance or len(log) < 3 or
                [(e['round'], e['role']) for e in log[-2:]] !=
                [(continue_failed['previous_rounds'], 'maker'), (continue_failed['previous_rounds'], 'client')] or
                log[-2].get('session_id') != continue_failed['maker_session'] or
                log[-1].get('session_id') != continue_failed['director_session'] or
                log[-1]['content'] != continue_failed['prompt_to_maker'] or
                continue_failed['previous_rounds'] >= max_rounds or
                continue_failed.get('authorization') != 'explicit_user_request' or
                json.loads((harness.SESSION / 'models.json').read_text()) !=
                {'maker': maker.metadata(), 'director': director.metadata()}):
            raise RuntimeError('Manual continuation requires intact sessions and unchanged models')
        extension = continue_failed
    if continue_capped:
        prior = json.loads((harness.SESSION / 'usage-summary.json').read_text())
        models = json.loads((harness.SESSION / 'models.json').read_text())
        if (not explicit_acceptance or prior.get('terminated') is not None or
                not prior.get('hit_max_rounds') or prior.get('condition') != cid or
                prior.get('run') != run_no or max_rounds <= prior['rounds'] or
                models != {'maker': maker.metadata(), 'director': director.metadata()} or
                len(log) < 3 or [(e['round'], e['role']) for e in log[-2:]] !=
                [(prior['rounds'], 'maker'), (prior['rounds'], 'client')] or
                not all(e.get('session_id') for e in log[-2:])):
            raise RuntimeError('Cap extension requires an intact capped dialogue and unchanged models')
        history = harness.SESSION / 'cap-extensions.jsonl'
        if history.exists() and any(json.loads(line)['previous_rounds'] == prior['rounds']
                                    for line in history.read_text().splitlines()):
            raise RuntimeError('This cap extension was already attempted; do not replay a failed call')
        extension = {'previous_rounds': prior['rounds'], 'max_rounds': max_rounds,
                     'paused_at': prior['ended_at'], 'resumed_at': datetime.now().isoformat(),
                     'maker_session': log[-2]['session_id'], 'director_session': log[-1]['session_id'],
                     'started_at': prior['started_at'], 'prompt_to_maker': log[-1]['content']}
        with history.open('a') as stream:
            stream.write(json.dumps({k: v for k, v in extension.items() if k != 'prompt_to_maker'}) + '\n')
    if resume and not continue_director:
        resumed_at = datetime.now()
        event = {"round": resume["round"], "resumed_at": resumed_at.isoformat(),
                 "paused_at": resume.get("paused_at")}
        if presentation_authorization:
            event['authorization'] = presentation_authorization
        if resume.get("paused_at"):
            event["pause_seconds"] = (resumed_at - datetime.fromisoformat(resume["paused_at"])).total_seconds()
        with (harness.SESSION / "presentation-resumes.jsonl").open("a") as stream:
            stream.write(json.dumps(event) + "\n")

    def _persist() -> None:
        log_path.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")

    t0 = (datetime.fromisoformat((resume or extension)['started_at'])
          if resume or extension else datetime.now())
    initial = harness.initial_prompt()
    if not resume and not extension:
        log.append({"round": 0, "role": "system", "content": initial, "chars": len(initial)})
        _persist()

    msid = (resume or extension)["maker_session"] if resume or extension else None
    dsid = (resume or extension)["director_session"] if resume or extension else None
    prompt_to_maker = extension['prompt_to_maker'] if extension else initial
    term = None
    last_sig = (tuple(tuple(x) for x in resume["last_sig"])
                if resume and resume["last_sig"] is not None else None)
    unchanged = resume["unchanged"] if resume else 0
    start_round = resume["round"] if resume else extension['previous_rounds'] + 1 if extension else 1

    for rnd in range(start_round, max_rounds + 1):
        if resume and rnd == start_round:
            if log[-1]["role"] != "maker" or log[-1]["round"] != rnd:
                raise RuntimeError("Checkpoint is not at the saved Maker presentation")
            maker_text = log[-1]["content"]
        else:
            with measurement.span(harness.SESSION / 'timing', 'maker_turn', round=rnd,
                                  method=method, phase_before=measurement.phase(harness.MAKER_WS)) as timing:
                m = _ask(harness.MAKER, maker, prompt_to_maker, msid)
                timing['phase_after'] = measurement.phase(harness.MAKER_WS)
            msid = m.get("session_id")
            maker_text = _text(m)
            log.append({"round": rnd, "role": "maker", "content": maker_text,
                        "chars": len(maker_text), "usage": _usage(m),
                        "cost_usd": m.get("total_cost_usd"),
                        "timing": m.get('timing'), "accounting": m.get('accounting'),
                        "session_id": msid, "artifacts": []})
            _persist()
        if continue_director and rnd == start_round:
            # Reuse the exact delivered references; do not recapture or replay Maker.
            refs = log[-1]['artifacts']
            review_issue = log[-1].get('presentation_review_issue', False)
            recovered = log[-1].get('presentation_recovered', False)
        else:
            checkpoint = {"condition": cid, "method": method, "run": run_no, "round": rnd,
                          "max_rounds": max_rounds, "started_at": t0.isoformat(),
                          "maker": maker.metadata(), "director": director.metadata(),
                          "maker_session": msid, "director_session": dsid,
                          "last_sig": last_sig, "unchanged": unchanged, "state": "presenting"}
            presentation_retry.save_checkpoint(checkpoint)
            try:
                with measurement.span(harness.SESSION / 'timing', 'presentation', round=rnd, method=method):
                    refs = presentation_retry.present_with_retry(curate, method, rnd)
            except presentation_retry.PresentationPaused as exc:
                log[-1]["presentation_error"] = {"kind": "environment_error", "message": str(exc)}
                _persist()
                checkpoint["state"] = "paused"
                checkpoint["paused_at"] = datetime.now().isoformat()
                presentation_retry.save_checkpoint(checkpoint)
                raise
            log[-1].pop("presentation_error", None)
            log[-1]["artifacts"] = refs
            review_issue = app_presentation.has_review_issue(harness.PRESENTATION / f"round-{rnd:02d}")
            log[-1]["presentation_review_issue"] = review_issue
            recovered = presentation_retry.was_retried(rnd)
            log[-1]["presentation_recovered"] = recovered
            _persist()
            presentation_retry.checkpoint_path().unlink()

        # Phase-state and unchanged-work success apply only to legacy sessions.
        # New trials wait for the Director's final-acceptance signal.
        sig = _workspace_sig()
        unchanged = unchanged + 1 if sig == last_sig else 0
        last_sig = sig
        if not explicit_acceptance and not review_issue and not recovered and _maker_converged(maker.provider):
            term = "converged"
            print(f"    round {rnd}: maker {len(maker_text)}c  [converged]")
            break
        if not explicit_acceptance and not review_issue and not recovered and unchanged >= STALL_ROUNDS:
            term = "settled"
            print(f"    round {rnd}: maker {len(maker_text)}c  [settled - no new output x{STALL_ROUNDS}]")
            break

        with measurement.span(harness.SESSION / 'timing', 'director_turn', round=rnd,
                              method=method, phase_before=measurement.phase(harness.MAKER_WS)):
            d = _ask(harness.DIRECTOR, director,
                     director_prompt(maker_text, refs, rnd, director.provider), dsid)
        dsid = d.get("session_id")
        raw_client_text = _text(d)
        client_text, accepted = (termination.split_response(raw_client_text)
                                 if explicit_acceptance else (raw_client_text, False))
        log.append({"round": rnd, "role": "client", "content": client_text,
                    "relayed": client_text, "chars": len(client_text), "usage": _usage(d),
                    "cost_usd": d.get("total_cost_usd"), "session_id": dsid,
                    "timing": d.get('timing'), "accounting": d.get('accounting'),
                    "raw_content": raw_client_text,
                    "control": {"final_accepted": accepted}})
        _persist()

        if accepted:
            status_file = harness.PRESENTATION / f'round-{rnd:02d}/_running-app/status.json'
            status = json.loads(status_file.read_text()) if status_file.exists() else {}
            if status.get('artifact_kind') != 'application':
                log[-1]['control']['invalid_reason'] = 'final_implementation_not_presented'
                _persist()
            else:
                term = 'accepted'
                (harness.SESSION / 'final-acceptance.json').write_text(json.dumps({
                    'round': rnd, 'client_accepted': True,
                    'outcome': term, 'scope': 'client acceptance, not reference coverage'}, indent=2))
                print(f'    round {rnd}: Director final acceptance [{term}]', flush=True)
                break
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
def expand_plan(plan: dict, models: dict | None = None) -> list[str]:
    order = plan.get("order", "interleaved")
    if order == "sequence":
        seq = list(plan["sequence"])
    elif order == "blocked":
        seq = [c for c in plan["conditions"] for _ in range(plan["repeat"])]
    else:  # interleaved
        seq = [c for _ in range(plan["repeat"]) for c in plan["conditions"]]

    if plan.get("resume"):
        skip = {c: harness.existing_run_count(c, models) for c in Counter(seq)}
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
    if presentation_retry.checkpoint_path().exists():
        return  # Keep the running app, role sessions and working files for repair.
    if (harness.SESSION / "context.md").exists():
        harness.teardown()


def run_one(cid: str, max_rounds: int, maker: llm.Model, director: llm.Model) -> None:
    method = harness.condition_spec(cid)["method"]
    try:
        run_no = harness.setup(cid, maker, director)
        print(f"  == {cid} run-{run_no:02d} ==")
        run_session(cid, method, run_no, max_rounds, maker, director)
    finally:
        _teardown_safe()


def resume_session() -> dict:
    if termination.stop_on_interruption(harness.SESSION):
        raise RuntimeError('Interrupted trial cannot resume; preserve it and use a separate trial for any rerun')
    state = presentation_retry.load_checkpoint()
    maker = llm.select("maker", state["maker"]["provider"])
    director = llm.select("director", state["director"]["provider"])
    if maker.metadata() != state["maker"] or director.metadata() != state["director"]:
        raise RuntimeError("Model configuration changed; restore the saved configuration before resuming")
    image_id = (harness.SESSION / "image-id.txt").read_text().strip()
    for role, workspace in ((harness.MAKER, harness.MAKER_WS), (harness.DIRECTOR, harness.DIRECTOR_WS)):
        info = json.loads(subprocess.check_output(["docker", "inspect", role], text=True))[0]
        mounts = {m["Destination"]: m["Source"] for m in info["Mounts"]}
        if (not info["State"]["Running"] or info["Image"] != image_id or
                mounts.get("/work") != str(workspace.resolve())):
            raise RuntimeError(f"{role}: saved running container/workspace is required for resume")
    try:
        return run_session(state["condition"], state["method"], state["run"],
                           state["max_rounds"], maker, director, resume=state)
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
    ap.add_argument("--maker", choices=["claude", "codex"])
    ap.add_argument("--director", choices=["claude", "codex"])
    ap.add_argument("--dry-run", action="store_true", help="show the selected pair and schedule without running")
    ap.add_argument("--resume-session", action="store_true", help="resume a paused presentation in the same round")
    args = ap.parse_args()
    if args.resume_session:
        if args.cid or args.trials or args.max_rounds or args.maker or args.director or args.dry_run:
            ap.error("--resume-session uses saved settings and cannot be combined with other options")
        try:
            resume_session()
        except presentation_retry.PresentationPaused as exc:
            print(f"[broker] {exc}", flush=True)
        return
    maker, director = llm.select("maker", args.maker), llm.select("director", args.director)
    models = {"maker": maker.metadata(), "director": director.metadata()}

    plan = yaml.safe_load((harness.CONFIG / "run-plan.yaml").read_text(encoding="utf-8"))["run_plan"]
    max_rounds = args.max_rounds or plan.get("max_rounds", 80)
    keep_going = plan.get("keep_going", True)

    if args.cid:
        seq = [args.cid] * (args.trials or 1)
    else:
        seq = expand_plan(plan, models)

    if not seq:
        print("[broker] nothing to run (resume: all targets already met?)")
        return

    print(f"[broker] schedule ({len(seq)} runs): {', '.join(seq)}")
    print(f"[broker] models: {json.dumps(models)}")
    if args.dry_run:
        return
    for i, cid in enumerate(seq, 1):
        print(f"[broker] {i}/{len(seq)} -> {cid}")
        try:
            run_one(cid, max_rounds, maker, director)
        except Exception as e:            # noqa: BLE001 - batch resilience
            if presentation_retry.checkpoint_path().exists():
                print(f"[broker] batch paused ({cid}): {e}", flush=True)
                return
            print(f"[broker] run failed ({cid}): {e}")
            if not keep_going:
                raise
    print("[broker] batch complete")


if __name__ == "__main__":
    main()
