import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import harness
import llm


def process(data, code=0):
    return subprocess.CompletedProcess([], code, stdout=json.dumps(data), stderr="")


class LLMTests(unittest.TestCase):
    def test_codex_session_and_usage(self):
        events = [{"type": "thread.started", "thread_id": "session-1"},
                  {"type": "item.completed", "item": {"type": "agent_message", "text": "answer"}},
                  {"type": "turn.completed", "usage": {"input_tokens": 100, "cached_input_tokens": 40, "output_tokens": 5}}]
        p = subprocess.CompletedProcess([], 0, stdout="\n".join(map(json.dumps, events)), stderr="")
        result = llm.parse(llm.select("maker", "codex"), p)
        self.assertEqual(result["result"], "answer")
        self.assertEqual(result["session_id"], "session-1")
        self.assertEqual(result["usage"]["cache_read_input_tokens"], 40)
        self.assertEqual(result["usage"]["input_tokens"], 60)
        self.assertEqual(result["native_usage"]["input_tokens"], 100)

    def test_errors_inside_successful_process_are_not_answers(self):
        for provider, data in [("claude", {"is_error": True, "result": "401 authentication required"})]:
            with self.subTest(provider=provider), self.assertRaises(llm.CallError) as caught:
                llm.parse(llm.select("judge", provider), process(data))
            self.assertFalse(caught.exception.retryable)

    def test_quota_preserves_new_session_identifier(self):
        data = {"is_error": True, "session_id": "started-before-limit", "result": "usage limit"}
        with self.assertRaises(llm.CallError) as caught:
            llm.parse(llm.select("maker", "claude"), process(data))
        self.assertTrue(caught.exception.retryable)
        self.assertEqual(caught.exception.session_id, "started-before-limit")

    def test_new_trial_does_not_replay_quota_failure(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(harness, 'SESSION', Path(temp)):
            (Path(temp) / 'control.json').write_text('{"interruption":"stop"}')
            failure = process({'is_error': True, 'session_id': 'partial-session',
                               'result': 'usage limit'})
            with patch.object(harness, 'run_llm', return_value=failure) as call, \
                    patch.object(llm.time, 'sleep') as sleep:
                with self.assertRaises(llm.CallError):
                    llm.invoke(harness.MAKER, llm.select('maker', 'claude'), 'Implement')
                self.assertEqual(call.call_count, 1)
                sleep.assert_not_called()

    def test_error_like_text_in_valid_answer_is_not_quota(self):
        result = llm.parse(llm.select("judge", "claude"), process({"is_error": False,
            "session_id": "s", "result": "HTTP 429 means rate limit", "usage": {"output_tokens": 5}}))
        self.assertIn("429", result["result"])
        self.assertEqual(result["usage"]["output_tokens"], 5)

    def test_unsupported_provider_cannot_be_selected_or_invoked(self):
        with self.assertRaises(ValueError):
            llm.select("judge", "retired-provider")
        with self.assertRaises(ValueError):
            llm.command(llm.Model("retired-provider", "old-model", "high"), "message")

    def test_resume_commands_keep_model_and_effort(self):
        for provider in ("claude", "codex"):
            model = llm.select("judge", provider)
            cmd = llm.command(model, "message", "session-1")
            self.assertIn("session-1", cmd)
            self.assertIn(model.model, cmd)
            self.assertIn(model.effort, " ".join(cmd))
            self.assertNotIn("--last", cmd)

    def test_policy_conversion_preserves_content(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)
            text = "Follow .claude/skills/ and .claude/principles.md.\n"
            (path / "CLAUDE.md").write_text(text)
            harness.adapt_policy(path, "codex")
            self.assertEqual((path / "AGENTS.md").read_text(), text.replace(".claude/skills/", ".agents/skills/"))
            self.assertFalse((path / "CLAUDE.md").exists())

    def test_resume_excludes_legacy_other_pairs_and_failed_runs(self):
        selected = {"maker": llm.select("maker", "codex").metadata(),
                    "director": llm.select("director", "claude").metadata()}
        with tempfile.TemporaryDirectory() as temp, patch.object(harness, "RUNS", Path(temp)):
            for number, models, terminated in [(1, None, "settled"), (2, {}, "settled"),
                                                 (3, selected, None), (4, selected, "settled")]:
                path = Path(temp) / "VC" / f"run-{number:02d}"
                (path / "session").mkdir(parents=True)
                (path / "meta.json").write_text(json.dumps({"models": models}))
                (path / "session/usage-summary.json").write_text(json.dumps({"terminated": terminated}))
            self.assertEqual(harness.existing_run_count("VC", selected), 1)


if __name__ == "__main__":
    unittest.main()
