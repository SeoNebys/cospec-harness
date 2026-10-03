"""Preserve generated dependencies and recover archives without another run."""
from contextlib import ExitStack
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import harness


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.root = Path(self.stack.enter_context(tempfile.TemporaryDirectory()))
        for key in ('MAKER_WS', 'MAKER_TS', 'DIRECTOR_WS', 'DIRECTOR_TS', 'PRESENTATION', 'SESSION', 'RUNS'):
            p = self.root / key
            p.mkdir()
            self.stack.enter_context(patch.object(harness, key, p))
        (harness.SESSION / 'context.md').write_text('- condition: SD-D\n- run: 1\n- method: sdd\n- engagement: diligent\n')
        (harness.SESSION / 'broker-log.json').write_text('[{"round":9}]')

    def test_dangling_and_external_links_preserved_without_reading_target(self):
        ws = harness.MAKER_WS
        (ws / 'font.conf').symlink_to('/unavailable/container/font.conf')
        outside = self.root / 'not-an-artifact'
        outside.write_text('external data must not be copied')
        (ws / 'outside').symlink_to(outside)
        (ws / 'app.txt').write_text('application')
        (ws / 'relative').symlink_to('app.txt')
        (harness.DIRECTOR_WS / 'AGENTS.md').write_text('saved policy')
        dst = harness.archive_current_run()
        self.assertTrue((dst / 'archive-complete.json').exists())
        for name in ('font.conf', 'outside', 'relative'):
            self.assertTrue((dst / 'maker-workspace' / name).is_symlink())
            self.assertEqual((dst / 'maker-workspace' / name).readlink(), (ws / name).readlink())
        self.assertEqual((dst / 'director-workspace/AGENTS.md').read_text(), 'saved policy')
        self.assertTrue((ws / 'app.txt').exists())

    def test_partial_archive_kept_and_not_merged(self):
        final = harness.RUNS / 'SD-D/run-01'
        final.mkdir(parents=True)
        (final / 'stale.txt').write_text('earlier partial copy')
        dst = harness.archive_current_run()
        self.assertFalse((dst / 'stale.txt').exists())
        backups = list(final.parent.glob('.run-01.partial-*'))
        self.assertEqual(len(backups), 1)
        self.assertEqual((backups[0] / 'stale.txt').read_text(), 'earlier partial copy')

    def test_trial_identity_is_preserved_in_archive_metadata_and_session(self):
        trial = {'trial_id': 'trial-031', 'order': 31, 'block': 2,
                 'condition': 'SD-D', 'maker': 'codex', 'director': 'claude',
                 'maker_effort': 'low', 'director_effort': 'medium'}
        (harness.SESSION / 'trial.json').write_text(json.dumps(trial))
        dst = harness.archive_current_run()
        self.assertEqual(json.loads((dst / 'meta.json').read_text())['trial'], trial)
        self.assertEqual(json.loads((dst / 'session/trial.json').read_text()), trial)

    def test_copy_failure_never_cleans_workspace_or_claims_completion(self):
        with patch.object(harness.shutil, 'copytree', side_effect=OSError('disk full')), \
                patch.object(harness, '_rm_container') as remove:
            with self.assertRaises(OSError):
                harness.teardown()
        remove.assert_not_called()
        self.assertTrue((harness.SESSION / 'broker-log.json').exists())
        self.assertFalse((harness.RUNS / 'SD-D/run-01').exists())
        self.assertFalse(list(harness.RUNS.rglob('archive-complete.json')))


if __name__ == '__main__':
    unittest.main()
