"""Official subscription CLIs with a common response and session interface."""
from __future__ import annotations

from dataclasses import asdict, dataclass
import json
import os
from pathlib import Path
import re
import subprocess
import threading
import time

import yaml
import termination
import measurement
import usage_accounting


@dataclass(frozen=True)
class Model:
    provider: str
    model: str
    effort: str

    @property
    def auth_provider(self):
        return self.provider

    def metadata(self):
        return asdict(self)


def select(role: str, provider: str | None = None, effort: str | None = None) -> Model:
    config = yaml.safe_load((Path(__file__).resolve().parents[1] / "config/llm.yaml").read_text())
    if os.environ.get("HARNESS_MODEL"):
        raise ValueError("Use config/llm.yaml instead of the ambiguous global HARNESS_MODEL")
    provider = provider or config["roles"][role]
    if provider not in {"claude", "codex"} or provider not in config["providers"]:
        raise ValueError(f"Unsupported {role} provider: {provider}")
    entry = config["providers"][provider]
    effort = effort or entry["effort"][role]
    if effort not in {"low", "medium", "high"} or not entry["model"]:
        raise ValueError("A fixed model and reasoning effort are required")
    return Model(provider, entry["model"], effort)


def judges() -> list[str]:
    config = yaml.safe_load((Path(__file__).resolve().parents[1] / "config/llm.yaml").read_text())
    providers = config["judges"]
    if not providers or len(set(providers)) != len(providers):
        raise ValueError("Judge providers must be nonempty and unique")
    for provider in providers:
        select("judge", provider)
    return providers


def command(model: Model, prompt: str, session_id: str | None = None) -> list[str]:
    if model.provider == "claude":
        args = ["claude", "-p", prompt, "--output-format", "json", "--model", model.model,
                "--effort", model.effort, "--dangerously-skip-permissions"]
        if session_id:
            args += ["--resume", session_id]
    elif model.provider == "codex":
        args = ["codex", "exec"]
        if session_id:
            args += ["resume"]
        args += ["--model", model.model, "-c", f'model_reasoning_effort="{model.effort}"',
                 "--skip-git-repo-check", "--json", "--dangerously-bypass-approvals-and-sandbox"]
        args += ([session_id] if session_id else []) + [prompt]
    else:
        raise ValueError("Unsupported provider")
    return args


class CallError(RuntimeError):
    def __init__(self, message, *, session_id=None, retryable=False):
        super().__init__(message)
        self.session_id, self.retryable = session_id, retryable


def parse(model: Model, proc: subprocess.CompletedProcess) -> dict:
    session_id = None
    errors = []
    text, usage, cost, observed, native_usage = "", {}, None, [], {}
    try:
        if model.provider == "codex":
            finished = False
            for line in proc.stdout.splitlines():
                event = json.loads(line)
                kind = event.get("type")
                if kind == "thread.started":
                    session_id = event["thread_id"]
                elif kind == "item.completed" and event.get("item", {}).get("type") == "agent_message":
                    text = event["item"]["text"]
                elif kind == "turn.completed":
                    finished, raw_usage = True, event.get("usage", {})
                    native_usage = raw_usage
                    usage = {"input_tokens": raw_usage.get("input_tokens", 0) - raw_usage.get("cached_input_tokens", 0),
                             "output_tokens": raw_usage.get("output_tokens", 0),
                             "cache_read_input_tokens": raw_usage.get("cached_input_tokens", 0)}
                elif kind in {"error", "turn.failed"}:
                    errors.append(str(event.get("error", event.get("message", "Codex error"))))
            if not finished:
                errors.append("No completed turn")
        elif model.provider == "claude":
            data = json.loads(proc.stdout)
            session_id, text = data.get("session_id"), data.get("result", "")
            usage, cost = data.get("usage", {}), data.get("total_cost_usd")
            native_usage = usage.copy()
            observed = list((data.get("modelUsage") or {}).keys())
            if data.get("is_error"):
                errors.append(str(data.get("errors", text)))
        else:
            raise ValueError("Unsupported provider")
    except (ValueError, KeyError, TypeError, AttributeError):
        errors.append("Malformed CLI output")
    if proc.returncode or errors or not text.strip():
        diagnostic = "\n".join(errors) + "\n" + (proc.stderr or "")
        auth_failure = bool(re.search(r"unauthenticated|authentication required|invalid.grant|"
                                      r"refresh.token|\b401\b|\b403\b|sign.in", diagnostic, re.I))
        limited = bool(re.search(r"rate.?limit|usage limit|session limit|quota|too many requests|"
                                 r"\b429\b|overloaded|\b529\b", diagnostic, re.I))
        permission_failure = "permission" in diagnostic.lower() and "denied" in diagnostic.lower()
        reason = ("authentication failed" if auth_failure else "usage limit" if limited
                  else "tool permission denied" if permission_failure else "CLI request failed")
        # Keep raw diagnostics out of console messages and auth recovery records.
        raise CallError(f"{model.provider}: {reason} (exit {proc.returncode})",
                        session_id=session_id, retryable=limited and not auth_failure)
    return {"result": text.strip(), "session_id": session_id, "usage": usage,
            "native_usage": native_usage, "total_cost_usd": cost,
            "model_config": model.metadata(), "observed_models": observed}


def _previous_codex_usage(record_dir, session_id):
    if not record_dir or not session_id:
        return None
    for path in sorted(record_dir.glob("call-*.json"), reverse=True):
        item = json.loads(path.read_text()).get("normalized", {})
        if item.get("session_id") == session_id and item.get("native_usage"):
            return usage_accounting.codex_usage(item["native_usage"])
    return None


def _invoke_attempt(container, model, prompt, session_id, record_dir, timeout, attempt):
    import harness
    transcript = {harness.MAKER: harness.MAKER_TS, harness.DIRECTOR: harness.DIRECTOR_TS}.get(container)
    before = (usage_accounting.codex_threads(transcript)
              if model.provider == "codex" and transcript else {})
    claude_before = usage_accounting.claude_messages(transcript) if model.provider == 'claude' else {}
    baseline = _previous_codex_usage(record_dir, session_id) if model.provider == 'codex' else None
    cmd = ["docker", "exec", "-w", "/work", container] + command(model, prompt, session_id)
    result, proc, requested_session = None, None, session_id
    directory = record_dir / "attempts" if record_dir else None
    with measurement.span(directory, "model_call", config=model.metadata(), role=container,
                          attempt=attempt, requested_session=session_id, timeout_seconds=timeout,
                          phase_before=measurement.phase(harness.MAKER_WS)) as record:
        stop = threading.Event()
        def heartbeat():
            while not stop.wait(30):
                print(f"[{container}/{model.provider}] request in progress", flush=True)
        worker = threading.Thread(target=heartbeat, daemon=True)
        worker.start()
        try:
            proc = harness.run_llm(model.auth_provider, container, cmd, capture_output=True,
                                   text=True, encoding="utf-8", timeout=timeout)
            result = parse(model, proc)
            if session_id and result["session_id"] and result["session_id"] != session_id:
                raise CallError(f"{model.provider}: resumed session ID changed")
            result["session_id"] = result["session_id"] or session_id
            if not result["session_id"]:
                raise CallError(f"{model.provider}: no resumable session identifier")
        except CallError as exc:
            session_id = exc.session_id or session_id
            raise
        except subprocess.TimeoutExpired as exc:
            # stdout is CLI task output; stderr/authentication diagnostics are not archived.
            partial = exc.stdout or ""
            record["stdout"] = partial.decode("utf-8", errors="replace") if isinstance(partial, bytes) else partial
            raise
        finally:
            stop.set()
            worker.join(timeout=1)
            record["phase_after"] = measurement.phase(harness.MAKER_WS)
            record["phase_assignment"] = ("stable_observation" if record["phase_before"] == record["phase_after"]
                                          else "transition_or_mixed")
            if proc is not None:
                record.update(stdout=proc.stdout, returncode=proc.returncode)
            if model.provider == "codex":
                after = usage_accounting.codex_threads(transcript) if transcript else {}
                accounting = usage_accounting.account_codex(result, before, after,
                                                            requested_session, baseline)
            elif model.provider == "claude":
                try:
                    data = json.loads(record.get("stdout") or "{}")
                except ValueError:
                    data = {}
                accounting = usage_accounting.claude_usage(data)
                if not data.get('modelUsage') and not data.get('usage'):
                    after_messages = usage_accounting.claude_messages(transcript)
                    accounting = {'usage': usage_accounting.add(
                        usage_accounting.difference(value, claude_before.get(mid, {})) or {}
                        for mid, value in after_messages.items()), 'complete': False,
                        'scope': 'observed_native_messages_after_interrupted_call',
                        'issues': ['CLI_total_unavailable; auxiliary_or_unreported_usage_unknown']}
                record["provider_duration_ms"] = data.get("duration_ms")
                record["provider_api_duration_ms"] = data.get("duration_api_ms")
            else:
                accounting = {"usage": (result or {}).get("usage", {}),
                              "scope": "reported_cli_usage", "complete": result is not None,
                              "issues": [] if result else ["usage_unavailable"]}
            record["accounting"] = accounting
            record["session_id"] = (result or {}).get("session_id") or session_id or accounting.get("session_id")
            if result is not None:
                result["usage"] = accounting["usage"]
                result["accounting"] = accounting
        record["normalized"] = result
    result["timing"] = {k: record[k] for k in ("id", "started_at", "ended_at", "elapsed_seconds",
                        "phase_before", "phase_after", "phase_assignment")}
    return result, proc


def invoke(container: str, model: Model, prompt: str, session_id=None, record_dir: Path | None = None):
    import harness
    timeout = int(os.environ.get("HARNESS_CALL_TIMEOUT", "10800"))
    wait = int(os.environ.get("HARNESS_LIMIT_WAIT", "900"))
    max_wait = int(os.environ.get("HARNESS_LIMIT_MAX_WAIT", "86400"))
    if container in (harness.MAKER, harness.DIRECTOR) and termination.stop_on_interruption(harness.SESSION):
        max_wait = 0
    if wait <= 0 or max_wait < 0:
        raise ValueError("Invalid quota retry settings")
    waited = 0
    attempt = 0
    while True:
        attempt += 1
        try:
            result, proc = _invoke_attempt(container, model, prompt, session_id, record_dir, timeout, attempt)
        except CallError as exc:
            session_id = exc.session_id or session_id
            if not exc.retryable or waited + wait > max_wait:
                raise
            print(f"[{container}/{model.provider}] quota wait: {wait}s", flush=True)
            with measurement.span(record_dir / "waits" if record_dir else None, "quota_wait",
                                  role=container, requested_seconds=wait):
                for elapsed in range(0, wait, 30):
                    time.sleep(min(30, wait - elapsed))
                    print(f"[{container}] waiting for quota ({elapsed + min(30, wait - elapsed)}s)", flush=True)
            waited += wait
            continue
        if record_dir:
            record_dir.mkdir(parents=True, exist_ok=True)
            index = len(list(record_dir.glob("call-*.json"))) + 1
            envelope = {"config": model.metadata(), "attempts": attempt, "quota_wait_seconds": waited,
                        "normalized": result, "stdout": proc.stdout}
            (record_dir / f"call-{index:04d}.json").write_text(json.dumps(envelope, ensure_ascii=False, indent=2))
        return result
