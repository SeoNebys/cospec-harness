"""Exercise credential rotation and recovery without real accounts or Docker."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from subscription_auth import AuthError, AuthStore, _atomic


def credential(provider, token):
    if provider == "claude":
        doc = {"claudeAiOauth": {"accessToken": token, "refreshToken": "test"}}
    elif provider == "codex":
        doc = {"auth_mode": "chatgpt", "tokens": {"access_token": token, "refresh_token": "test"}}
    else:
        raise ValueError("Unsupported provider")
    return json.dumps(doc).encode()


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        env = {"HARNESS_AUTH_STATE_DIR": str(self.root / "state")}
        for provider in ("claude", "codex"):
            path = self.root / provider
            path.write_bytes(credential(provider, "initial"))
            env[f"HARNESS_{provider.upper()}_AUTH_FILE"] = str(path)
        self.env = patch.dict(os.environ, env)
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_atomic_refresh_survives_recreation_for_all_providers(self):
        for provider in ("claude", "codex"):
            with self.subTest(provider=provider):
                maker = AuthStore(provider, "maker")
                maker.container_args()
                def refresh(*args, **kwargs):
                    _atomic(maker.credential, credential(provider, "refreshed"))
                    return subprocess.CompletedProcess([], 0)
                with patch("subscription_auth.subprocess.run", side_effect=refresh):
                    maker.run(["fake-cli"])
                self.assertEqual(maker.source.read_bytes(), credential(provider, "refreshed"))
                self.assertEqual(maker.source.stat().st_mode & 0o777, 0o600)
                (maker.home / "old-session").write_text("must not carry into next run")
                maker.container_args()
                self.assertFalse((maker.home / "old-session").exists())
                director = AuthStore(provider, "director")
                director.container_args()
                self.assertEqual(director.credential.read_bytes(), credential(provider, "refreshed"))
                self.assertNotEqual(maker.home, director.home)
                self.assertFalse(maker.journal.exists())

    def test_external_rotation_is_not_overwritten(self):
        store = AuthStore("codex", "maker")
        store.container_args()
        def conflict(*args, **kwargs):
            _atomic(store.credential, credential("codex", "runtime-refresh"))
            _atomic(store.source, credential("codex", "external-refresh"))
            return subprocess.CompletedProcess([], 0)
        with patch("subscription_auth.subprocess.run", side_effect=conflict):
            with self.assertRaisesRegex(AuthError, "changed outside"):
                store.run(["fake-cli"])
        self.assertEqual(store.source.read_bytes(), credential("codex", "external-refresh"))
        self.assertTrue(store.journal.exists())
        with self.assertRaisesRegex(AuthError, "unfinished"):
            store.container_args()

    def test_refresh_saved_even_when_model_call_fails(self):
        store = AuthStore("claude", "judge")
        store.container_args()
        def failed_call(*args, **kwargs):
            _atomic(store.credential, credential("claude", "refreshed"))
            return subprocess.CompletedProcess([], 1)
        with patch("subscription_auth.subprocess.run", side_effect=failed_call):
            self.assertEqual(store.run(["fake-cli"]).returncode, 1)
        self.assertEqual(store.source.read_bytes(), credential("claude", "refreshed"))

    def test_recover_interrupted_writeback(self):
        store = AuthStore("codex", "judge")
        store.container_args()
        def refreshed(*args, **kwargs):
            _atomic(store.credential, credential("codex", "refreshed"))
            return subprocess.CompletedProcess([], 0)
        with patch("subscription_auth.subprocess.run", side_effect=refreshed):
            with patch.object(store, "_commit", side_effect=OSError("interrupted")):
                with self.assertRaises(OSError):
                    store.run(["fake-cli"])
        with patch("subscription_auth.subprocess.run", return_value=subprocess.CompletedProcess([], 0, stdout="")):
            store.recover()
        self.assertEqual(store.source.read_bytes(), credential("codex", "refreshed"))
        self.assertFalse(store.journal.exists())

    def test_timeout_stops_container_before_writeback(self):
        store = AuthStore("claude", "maker")
        store.container_args()
        calls = []
        def interrupted(cmd, **kwargs):
            calls.append(cmd)
            if cmd == ["fake-cli"]:
                raise subprocess.TimeoutExpired(cmd, 1)
            _atomic(store.credential, credential("claude", "refreshed"))
            return subprocess.CompletedProcess(cmd, 0)
        with patch("subscription_auth.subprocess.run", side_effect=interrupted):
            with self.assertRaises(subprocess.TimeoutExpired):
                store.run(["fake-cli"])
        self.assertEqual(calls[-1], ["docker", "rm", "-f", "maker"])
        self.assertEqual(store.source.read_bytes(), credential("claude", "refreshed"))

    def test_missing_auth_fails_before_container_creation(self):
        store = AuthStore("codex", "maker")
        store.source.unlink()
        with self.assertRaisesRegex(AuthError, "log in first"):
            store.container_args()


if __name__ == "__main__":
    unittest.main()
