"""Offline checks for presented-text measurement from archived runs."""
import json
import tempfile
import unittest
from pathlib import Path

import aggregate


class PresentedTextTests(unittest.TestCase):
    def make_run(self, root, method, engagement):
        run = Path(root)
        (run / "meta.json").write_text(json.dumps({
            "method": method, "engagement": engagement,
        }), encoding="utf-8")
        log = []
        for n, spec in enumerate(("요구😀", "요구😀", "수"), 1):
            rd = run / "presentation" / f"round-{n:02d}"
            rd.mkdir(parents=True)
            (rd / "spec.md").write_text(spec, encoding="utf-8")
            (rd / "plan.md").write_text("계획", encoding="utf-8")
            (rd / "prototype.html").write_text("excluded HTML", encoding="utf-8")
            (rd / "preview.png").write_bytes(b"excluded image")
            (rd / "app.js").write_text("excluded code", encoding="utf-8")
            log.extend([
                {"round": n, "role": "maker", "content": "Review", "chars": 6},
                {"round": n, "role": "client", "content": "OK", "chars": 2},
            ])
        (run / "broker-log.json").write_text(json.dumps(log), encoding="utf-8")
        return run

    def test_both_sdd_policies_count_unicode_and_repeated_or_shortened_documents(self):
        for engagement in ("satisficing", "diligent"):
            with self.subTest(engagement=engagement), tempfile.TemporaryDirectory() as tmp:
                run = self.make_run(tmp, "sdd", engagement)
                metrics = aggregate.run_metrics(run)
                # Full per-turn totals: 6+3+2, 6+3+2, 6+1+2.
                self.assertEqual(metrics["throughput"], 31)
                self.assertEqual(metrics["chunk_median"], 11)
                self.assertEqual(metrics["chunk_max"], 11)
                self.assertEqual(metrics["utterances"], 3)
                self.assertEqual(metrics["input_chars"], 6)

    def test_other_methods_count_only_maker_messages(self):
        for method in ("vc", "cospec"):
            with self.subTest(method=method), tempfile.TemporaryDirectory() as tmp:
                run = self.make_run(tmp, method, "satisficing")
                metrics = aggregate.run_metrics(run)
                self.assertEqual(metrics["throughput"], 18)
                self.assertEqual(metrics["chunk_median"], 6)
                self.assertEqual(metrics["chunk_max"], 6)

    def test_sdd_without_presented_documents_counts_messages(self):
        with tempfile.TemporaryDirectory() as tmp:
            run = Path(tmp)
            (run / "meta.json").write_text('{"method": "sdd"}', encoding="utf-8")
            (run / "broker-log.json").write_text(json.dumps([
                {"round": 1, "role": "maker", "content": "Review", "chars": 6},
                {"round": 1, "role": "client", "content": "OK", "chars": 2},
            ]), encoding="utf-8")
            self.assertEqual(aggregate.run_metrics(run)["throughput"], 6)


if __name__ == "__main__":
    unittest.main()
