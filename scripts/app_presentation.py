"""Read the Maker's runtime endpoint and publish a checked HTTP presentation."""
import json
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit

import harness
import app_runtime
from render_preview import render_app


class PresentationEnvironmentError(RuntimeError):
    """The harness cannot perform a reliable presentation check."""


def endpoint(workspace: Path) -> dict | None:
    manifest = workspace / ".harness/app.json"
    if not manifest.exists():
        return None
    if not manifest.resolve().is_relative_to(workspace.resolve()):
        raise ValueError("App manifest must be inside the Maker workspace")
    value = json.loads(manifest.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("App manifest must be an object")
    port, path = value.get("port"), value.get("path", "/")
    if type(port) is not int or not 1 <= port <= 65535:
        raise ValueError("App port must be an integer from 1 to 65535")
    if (not isinstance(path, str) or not path.startswith("/") or path.startswith("//") or
            any(c.isspace() or ord(c) < 32 for c in path) or "\\" in path or
            urlsplit(path).netloc or urlsplit(path).fragment):
        raise ValueError("App path must be a local absolute URL path")
    selector = value.get("ready_selector")
    if selector is not None and (not isinstance(selector, str) or not selector.strip()):
        raise ValueError("App readiness selector must be a nonempty string")
    app = {"port": port, "path": path, "ready_selector": selector}
    if (workspace / '.harness/runtime-contract.json').exists():
        kind = value.get('kind')
        expected = {'application': harness.APP_PORT, 'prototype': harness.PROTOTYPE_PORT}
        if kind not in expected or port != expected[kind]:
            raise ValueError('Declare kind=application on port 4000 or kind=prototype on port 4001')
        if 'start_command' not in value:
            raise ValueError('A foreground start_command is required')
        app.update(kind=kind, ready_selector='[data-harness-ready="true"]')
    if 'start_command' in value:
        command = value['start_command']
        if (not isinstance(command, list) or not command or
                any(not isinstance(arg, str) or not arg or '\x00' in arg for arg in command)):
            raise ValueError('App start_command must be a nonempty argument array')
        cwd = value.get('start_cwd', '/work')
        if (not isinstance(cwd, str) or '\x00' in cwd or
                not PurePosixPath(cwd).is_relative_to('/work') or '..' in PurePosixPath(cwd).parts):
            raise ValueError('App start_cwd must be /work or a directory below it')
        app.update(start_command=command, start_cwd=cwd)
    return app


def present(workspace: Path, dest: Path, round_no: int) -> list[str]:
    if not (workspace / ".harness/app.json").exists():
        return []
    # Separate screenshots from prototype image assets copied into this round.
    capture = dest / "_running-app"
    if capture.exists():
        raise PresentationEnvironmentError("Reserved running-app presentation directory already exists")
    capture.mkdir()
    url = None
    try:
        try:
            app = endpoint(workspace)
        except (ValueError, TypeError) as exc:
            result = {"ok": False, "capture_ok": False, "failure_kind": "metadata_issue",
                      "error": str(exc), "issues": ["address_not_registered_correctly"]}
        else:
            capture_url = harness.maker_http_url(app["port"], app["path"])
            url = (harness.director_http_url(app['port'], app['path'])
                   if 'kind' in app else capture_url)
            runtime = app_runtime.ensure_started(workspace, app, capture_url, round_no)
            result = render_app(capture_url, capture / "screen.png", app["ready_selector"])
            if 'kind' in app:
                result.update(director_url=url, artifact_kind=app['kind'])
                if result.get('capture_ok'):
                    harness.check_director_route(app['port'])
                    result['director_route_verified'] = True
            if runtime:
                result['runtime'] = runtime
    except Exception as exc:
        result = {"ok": False, "failure_kind": "environment_error",
                  "error": f"{type(exc).__name__}: {exc}"}
    (capture / "status.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    base = f"/presentation/round-{round_no:02d}/_running-app"
    kind = result.get("failure_kind")
    if kind == "environment_error" or (not result["ok"] and kind not in {
            "application_issue", "access_issue", "metadata_issue"}):
        raise PresentationEnvironmentError(f"Presentation environment failed; see {capture / 'status.json'}")
    refs = [url] if url else []
    if not result["ok"]:
        notices = {
            "application_issue": "The supplied page was captured, but loading problems were observed. "
                "The screenshot and text show what was available; they do not confirm successful operation.",
            "access_issue": "The supplied application address could not be loaded during this check. "
                "The cause has not been established. No application screen was captured.",
            "metadata_issue": "A usable application address was not provided. "
                "No application screen could be captured.",
        }
        notice = notices[kind]
        if "http_error" in result.get("issues", []):
            notice += f" The address returned HTTP {result.get('status')}."
        if "empty_screen" in result.get("issues", []):
            notice += " No visible application content appeared within the capture wait."
        if "readiness_unconfirmed" in result.get("issues", []):
            notice += " The declared ready state could not be confirmed."
        (capture / "notice.txt").write_text(notice + "\n", encoding="utf-8")
        refs.append(f"{base}/notice.txt")
    if result.get("capture_ok"):
        (capture / "screen.txt").write_text(result.get("body_text", ""), encoding="utf-8")
        refs.extend([f"{base}/screen.png", f"{base}/screen.txt"])
    return refs


def has_review_issue(dest: Path) -> bool:
    status = dest / "_running-app/status.json"
    return status.exists() and not json.loads(status.read_text())["ok"]
