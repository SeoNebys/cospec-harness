"""File-backed subscription auth for sequential Linux container calls.

The VM credential is authoritative. Only a role's credential and fresh CLI state
are mounted; host histories, instructions and other providers are never mounted.
CLI refreshes are committed back after each call, including failed calls.
"""
from __future__ import annotations

import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from contextlib import contextmanager


PROVIDERS = {
    "claude": (".claude/.credentials.json", ".credentials.json", "/home/node/.claude"),
    "codex": (".codex/auth.json", "auth.json", "/home/node/.codex"),
}
ROLES = {"maker", "director", "judge", "auth-check"}


class AuthError(RuntimeError):
    """An auth failure safe to print: never includes credential contents."""


def _atomic(path: Path, data: bytes) -> None:
    fd, name = tempfile.mkstemp(prefix=".auth-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def _digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _validate(provider: str, data: bytes) -> None:
    try:
        doc = json.loads(data)
        if provider == "claude":
            valid = bool(doc["claudeAiOauth"]["accessToken"])
        elif provider == "codex":
            valid = (doc["auth_mode"] == "chatgpt" and not doc.get("OPENAI_API_KEY")
                     and bool(doc["tokens"]["access_token"]))
        else:
            raise ValueError("Unsupported provider")
        if not valid:
            raise ValueError
    except (ValueError, KeyError, TypeError):
        raise AuthError(f"{provider}: valid subscription login required on the VM") from None


class AuthStore:
    def __init__(self, provider: str, role: str):
        if provider not in PROVIDERS or role not in ROLES:
            raise AuthError("Unsupported auth provider or container role")
        self.provider, self.role = provider, role
        source, filename, self.target = PROVIDERS[provider]
        self.source = Path(os.environ.get(f"HARNESS_{provider.upper()}_AUTH_FILE",
                                         str(Path.home() / source))).expanduser().resolve()
        self.root = Path(os.environ.get("HARNESS_AUTH_STATE_DIR",
                                       str(Path.home() / ".local/state/cospec/auth"))).expanduser().resolve()
        repo = Path(__file__).resolve().parents[1]
        if self.root.is_relative_to(repo.parent) or self.source.is_relative_to(repo.parent):
            raise AuthError("Authentication storage must be outside the experiment repository")
        if self.source.is_relative_to(self.root):
            raise AuthError("Authoritative authentication must be outside the runtime state directory")
        self.home = self.root / "runtime" / role / provider
        self.credential = self.home / filename
        self.journal = self.root / f"{provider}.pending.json"

    @contextmanager
    def locked(self):
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.root.chmod(0o700)
        lockfile = self.root / f"{self.provider}.lock"
        fd = os.open(lockfile, os.O_CREAT | os.O_RDWR, 0o600)
        with os.fdopen(fd, "r+") as stream:
            fcntl.flock(stream, fcntl.LOCK_EX)
            yield

    def _read_source(self) -> bytes:
        try:
            data = self.source.read_bytes()
        except OSError:
            raise AuthError(f"{self.provider}: VM authentication file is unavailable; log in first") from None
        _validate(self.provider, data)
        return data

    def _require_clean(self):
        if self.journal.exists():
            raise AuthError(f"{self.provider}: unfinished auth write-back; preserve runtime state "
                            "and recover it before another call (see docker/authentication.md)")

    def container_args(self) -> list[str]:
        """Call only after removing the previous role container."""
        with self.locked():
            self._require_clean()
            data = self._read_source()
            if self.home.exists():
                shutil.rmtree(self.home)
            self.home.mkdir(parents=True, mode=0o700)
            _atomic(self.credential, data)
            if self.provider == "codex":
                _atomic(self.home / "config.toml", b'cli_auth_credentials_store = "file"\n')
        return ["--mount", f"type=bind,source={self.home},target={self.target}"]

    def _commit(self, before: str):
        try:
            updated = self.credential.read_bytes()
        except OSError:
            raise AuthError(f"{self.provider}: runtime credential missing; write-back stopped") from None
        _validate(self.provider, updated)
        if _digest(updated) != before:
            current = self._read_source()
            if _digest(current) != before and current != updated:
                raise AuthError(f"{self.provider}: VM auth changed outside this harness; "
                                "write-back stopped without overwriting it")
            if current != updated:
                _atomic(self.source, updated)
        self.journal.unlink()

    def run(self, cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
        with self.locked():
            self._require_clean()
            if not self.home.is_dir():
                raise AuthError("Create the authenticated container before invoking its CLI")
            data = self._read_source()
            _atomic(self.credential, data)
            before = _digest(data)
            _atomic(self.journal, json.dumps({"role": self.role, "source": str(self.source),
                                             "before": before}).encode())
            commit_allowed = True
            try:
                return subprocess.run(cmd, **kwargs)
            except (subprocess.TimeoutExpired, KeyboardInterrupt):
                # Killing docker exec alone can leave the CLI refreshing in the
                # container. Stop our role container before committing its state.
                commit_allowed = False
                stopped = subprocess.run(["docker", "rm", "-f", self.role],
                                         capture_output=True, timeout=30)
                if stopped.returncode:
                    raise AuthError("Could not stop the interrupted role container; auth recovery required")
                commit_allowed = True
                raise
            finally:
                # If shutdown failed, leave the journal for explicit recovery.
                if commit_allowed:
                    self._commit(before)

    def recover(self):
        """Recover a refresh after a host crash; the old container must be gone."""
        with self.locked():
            if not self.journal.exists():
                return
            pending = json.loads(self.journal.read_text())
            if pending["role"] != self.role or pending["source"] != str(self.source):
                raise AuthError("Recovery role/source differs from the pending call")
            check = subprocess.run(["docker", "ps", "-aq", "--filter", f"name=^/{self.role}$"],
                                   capture_output=True, text=True, check=True)
            if check.stdout.strip():
                raise AuthError("Remove the old role container before recovering auth")
            self._commit(pending["before"])


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["check", "recover"])
    parser.add_argument("provider", choices=PROVIDERS)
    parser.add_argument("--role", choices=sorted(ROLES), default="maker")
    args = parser.parse_args()
    store = AuthStore(args.provider, args.role)
    if args.command == "recover":
        store.recover()
    else:
        store._read_source()
    print(f"{args.provider}: {args.command} passed (no credentials printed)")
