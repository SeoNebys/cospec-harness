"""Bounded retries of presentation only; model calls are never replayed here."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import time

import harness
import termination
from app_presentation import PresentationEnvironmentError


class PresentationPaused(PresentationEnvironmentError):
    """Presentation stopped; only legacy sessions permit manual resumption."""


def checkpoint_path() -> Path:
    return harness.SESSION / "presentation-checkpoint.json"


def save_checkpoint(state: dict) -> None:
    state = dict(state)
    state["log_sha256"] = hashlib.sha256((harness.SESSION / "broker-log.json").read_bytes()).hexdigest()
    target = checkpoint_path()
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2))
    temporary.replace(target)


def load_checkpoint() -> dict:
    state = json.loads(checkpoint_path().read_text())
    actual = hashlib.sha256((harness.SESSION / "broker-log.json").read_bytes()).hexdigest()
    if actual != state["log_sha256"]:
        raise RuntimeError("Saved dialogue differs from the presentation checkpoint")
    return state


def limits() -> tuple[int, float]:
    attempts = int(os.environ.get("HARNESS_PRESENTATION_ATTEMPTS", "3"))
    delay = float(os.environ.get("HARNESS_PRESENTATION_RETRY_DELAY", "10"))
    if not 1 <= attempts <= 20 or not 0 <= delay <= 60:
        raise ValueError("Presentation attempts must be 1..20 and retry delay 0..60 seconds")
    return attempts, delay


def was_retried(round_no: int) -> bool:
    history = harness.SESSION / "presentation-attempts" / f"round-{round_no:02d}"
    return any(json.loads(p.read_text()).get("outcome") == "environment_error"
               for p in history.glob("attempt-*.json"))


def present_with_retry(curate, method: str, round_no: int) -> list[str]:
    maximum, delay = limits()
    history = harness.SESSION / "presentation-attempts" / f"round-{round_no:02d}"
    history.mkdir(parents=True, exist_ok=True)
    dest = harness.PRESENTATION / f"round-{round_no:02d}"
    # Preserve any interrupted attempt before rebuilding this same presentation.
    if dest.exists():
        index = len(list(history.iterdir())) + 1
        dest.rename(history / f"interrupted-{index:04d}")
    for attempt in range(1, maximum + 1):
        index = len(list(history.glob("attempt-*.json"))) + 1
        start = time.monotonic()
        event = {"round": round_no, "attempt": index,
                 "attempt_in_cycle": attempt, "max_attempts": maximum,
                 "retry_delay_seconds": delay,
                 "started_at": datetime.now(timezone.utc).isoformat(), "wait_seconds": 0}
        error = None
        try:
            refs = curate(method, round_no)
            event["outcome"] = "delivered"
        except (PresentationEnvironmentError, OSError) as exc:
            error = exc
            event.update(outcome="environment_error", error=f"{type(exc).__name__}: {exc}")
            if dest.exists():
                dest.rename(history / f"failed-{index:04d}")
        event["elapsed_seconds"] = round(time.monotonic() - start, 3)
        record = history / f"attempt-{index:04d}.json"
        record.write_text(json.dumps(event, ensure_ascii=False, indent=2))
        if error is None:
            return refs
        if attempt == maximum:
            next_step = ('preserve this interrupted trial; any rerun must be a separate trial'
                         if termination.stop_on_interruption(harness.SESSION) else
                         'repair the environment, then use --resume-session')
            raise PresentationPaused(
                f"Round {round_no}: presentation paused after {maximum} attempts; "
                + next_step) from error
        print(f"    round {round_no}: presentation environment error; retry in {delay:g}s "
              f"({attempt}/{maximum}, same Maker response)", flush=True)
        wait_start = time.monotonic()
        try:
            remaining = delay
            while remaining > 0:
                step = min(remaining, 10)
                time.sleep(step)
                remaining -= step
        finally:
            event["wait_seconds"] = round(time.monotonic() - wait_start, 3)
            record.write_text(json.dumps(event, ensure_ascii=False, indent=2))
    raise AssertionError("Unreachable")
