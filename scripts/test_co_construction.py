"""Offline regression checks for co-construction judgments."""
import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import aggregate
import audit_statistics
import judge
import make_rater_sheets
from co_construction import has_response_classes, summarise


def decision(response, ref="REF-BM-06"):
    return dict(ref_items=[ref], diverged=response != "not_divergent",
                response_class=response, caught=response in {"corrective", "accepted_divergence"},
                catch_type="correct" if response == "corrective" else "none",
                evidence="round 1 maker: duplicate saved; client: edit the existing item",
                note="Synthetic classification fixture")


class JudgmentTests(unittest.TestCase):
    def test_accepted_departure_counts_as_capture_and_keeps_denominator(self):
        raw = dict(n_g=999, decisions=[decision(c) for c in
                   ("corrective", "accepted_divergence", "unexpressed_divergence",
                    "unresolved", "not_divergent")])
        result = summarise(raw)
        self.assertEqual((result["n_g"], result["n_m"], result["opportunities"]), (2, 1, 3))
        self.assertEqual((result["n_c"], result["n_a"]), (1, 1))
        self.assertEqual(result["accepted_divergences"], 1)
        self.assertEqual(result["unexpressed_divergences"], 1)
        self.assertEqual(result["unresolved_decisions"], 1)
        self.assertAlmostEqual(result["capture_rate"], 2 / 3)
        self.assertEqual(raw["n_g"], 999)  # no mutation of source judgments

    def test_no_opportunities_has_no_rate(self):
        pending = decision("unresolved")
        pending["diverged"] = None
        for decisions in ([], [pending], [decision("not_divergent")]):
            result = summarise(dict(decisions=decisions))
            self.assertIsNone(result["capture_rate"])
            self.assertEqual(result["opportunities"], 0)

    def test_capture_rate_includes_acceptance_but_reports_corrective_count(self):
        decisions = ([decision("corrective")] * 6 + [decision("accepted_divergence")] * 3
                     + [decision("unexpressed_divergence")] * 2 + [decision("unresolved")])
        result = summarise(dict(decisions=decisions))
        self.assertEqual((result["n_c"], result["n_a"], result["n_g"], result["n_m"]), (6, 3, 9, 2))
        self.assertEqual(result["opportunities"], 11)
        self.assertAlmostEqual(result["capture_rate"], 9 / 11)
        self.assertEqual(result["unresolved_decisions"], 1)

    def test_corrective_actions_and_accepted_capture_have_distinct_types(self):
        for action in ("negate", "correct", "extend", "select"):
            result = summarise(dict(decisions=[decision("corrective") | {"catch_type": action}]))
            self.assertEqual((result["n_g"], result["n_c"], result["n_a"]), (1, 1, 0))
        result = summarise(dict(decisions=[decision("accepted_divergence")]))
        self.assertEqual((result["n_g"], result["n_c"], result["n_a"], result["n_m"]), (1, 0, 1, 0))
        self.assertTrue(result["decisions"][0]["caught"])
        self.assertEqual(result["decisions"][0]["catch_type"], "none")

    def test_format_detection_uses_response_fields_including_empty_results(self):
        self.assertFalse(has_response_classes(dict(n_g=0, decisions=[])))
        self.assertTrue(has_response_classes(summarise(dict(decisions=[]))))
        classified = decision("accepted_divergence")
        raw = dict(decisions=[classified])
        self.assertTrue(has_response_classes(raw))
        self.assertEqual(summarise(raw)["accepted_divergences"], 1)
        mixed = dict(decisions=[classified, dict(caught=False)])
        self.assertTrue(has_response_classes(mixed))
        with self.assertRaises(ValueError):
            summarise(mixed)

    def test_rejects_inconsistent_or_unsupported_judgments(self):
        for changes in ({"caught": False}, {"catch_type": "correct"},
                        {"diverged": False}, {"evidence": ""}, {"ref_items": []},
                        {"response_class": []}, {"catch_type": []}):
            item = decision("accepted_divergence") | changes
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                summarise(dict(decisions=[item]))
        with self.assertRaises(ValueError):
            summarise(dict(decisions="invalid"))

    def test_judge_validates_model_output_without_live_execution(self):
        with tempfile.TemporaryDirectory() as tmp:
            run = Path(tmp)
            (run / "broker-log.json").write_text("[]")
            for raw, expected_error in (
                (json.dumps(dict(decisions=[decision("accepted_divergence")])), None),
                (json.dumps(dict(decisions=[decision("accepted_divergence") | {"caught": False}])), "validation_error"),
                ("no JSON", "parse_error"),
            ):
                with patch.object(judge.subprocess, "run"), patch.object(judge.harness, "auth_env", return_value=[]), \
                     patch.object(judge, "_ask", return_value=raw):
                    result = judge.co_construction(run)
                if expected_error:
                    self.assertTrue(result[expected_error])
                else:
                    self.assertEqual(result["n_m"], 0)
                    self.assertEqual(result["n_g"], 1)
                    self.assertEqual(result["accepted_divergences"], 1)

    def test_audit_and_aggregate_handle_response_classes_and_catch_flags(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            run = root / "TEST" / "run-01"
            run.mkdir(parents=True)
            (run / "broker-log.json").write_text("[]")
            file = run / "ng-judgment.json"
            result = summarise(dict(decisions=[
                decision("corrective"), decision("accepted_divergence"),
                decision("unexpressed_divergence")]))
            file.write_text(json.dumps(result))
            with patch.object(audit_statistics.harness, "ROOT", root):
                audit = audit_statistics.normalise_ng(run, {})
            self.assertEqual(audit["status"], "ok")
            self.assertEqual(audit["detailed_misses"], 1)
            self.assertEqual(audit["accepted_divergences"], 1)
            self.assertEqual((audit["detailed_caught"], audit["n_c"], audit["n_a"]), (2, 1, 1))
            metrics = aggregate.run_metrics(run)
            self.assertEqual(metrics["n_m"], 1)
            self.assertEqual(metrics["accepted_divergences"], 1)
            self.assertEqual((metrics["n_g"], metrics["n_c"], metrics["n_a"]), (2, 1, 1))
            self.assertAlmostEqual(metrics["capture_rate"], 2 / 3)
            catch_flags = dict(n_g=1, satisficing_misses=1, decisions=[
                dict(ref_items=["REF-BM-06"], diverged=True, caught=True, catch_type="correct", note="caught"),
                dict(ref_items=["REF-BM-10"], diverged=True, caught=False, catch_type="none", note="passed")])
            original = json.dumps(catch_flags)
            file.write_text(original)
            with patch.object(audit_statistics.harness, "ROOT", root):
                audit = audit_statistics.normalise_ng(run, {})
            self.assertEqual(audit["status"], "ok")
            self.assertEqual(audit["catch_rate"], 0.5)
            self.assertNotIn("accepted_divergences", audit)
            self.assertIsNone(aggregate.run_metrics(run)["accepted_divergences"])
            self.assertEqual(file.read_text(), original)

    def test_human_sheet_has_blank_fields_for_independent_classification(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp) / "answers.csv"
            make_rater_sheets.write_cc_answers(file, [dict(item_id="CC-01", session="S1", ref_items=["REF-BM-06"])], "H1")
            with file.open() as handle:
                rows = list(csv.reader(handle))
            self.assertTrue(all(len(row) == len(make_rater_sheets.CC_HEADER) for row in rows))
            self.assertEqual(rows[1][-2:], ["q7_response_class", "q8_evidence"])
            self.assertEqual(rows[2][-2:], ["", ""])

    def test_unresolved_only_summary_and_incompatible_formats(self):
        rows = {"TEST/run-01": dict(judgment_format="response-classes", n_c=0, n_a=0, detailed_caught=0,
                                   detailed_misses=0, catch_rate=None,
                                   accepted_divergences=0, unexpressed_divergences=0,
                                   unresolved_decisions=1)}
        with patch.object(audit_statistics, "_run_dirs", return_value={"TEST": [Path("run-01")]}):
            result = audit_statistics._catch_summary(rows, "planned")["TEST"]
        self.assertIsNone(result["pooled_catch_rate"])
        self.assertEqual(result["run_rate"]["n"], 0)
        self.assertEqual(result["unresolved_decisions"], 1)
        rows["FLAGS/run-01"] = dict(judgment_format="catch-flags")
        with self.assertRaises(ValueError):
            audit_statistics._catch_summary(rows, "planned")


if __name__ == "__main__":
    unittest.main()
