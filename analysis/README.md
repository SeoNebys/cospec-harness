# Final experiment analysis

This directory reproduces the final analysis of 150 trials: five conditions,
two cross-model Maker/Director pairs, three Maker effort levels, and five
repetitions per combination. Each trial has implementation-coverage and
co-construction judgments from Claude and Codex, for 600 final judgments.

## Reproduction

From the repository root, with Python 3.11 or later:

```sh
python3 analysis/final-results-20260928.py
python3 analysis/r3-5-analysis.py
python3 analysis/requirement-agreement.py
```

No package installation, Docker, model credentials, or new Judge calls are
needed for analysis. The scripts read `runs/` and write only into this
directory. Run the summary first: the permutation analysis verifies its frozen
300-row input CSV hash before calculating any test. Input records are checked
against SHA-256 hashes, including the hashes of final judgments in execution
state. Reproduction does not reclassify decisions or repair source records.

## Files

| Files | Purpose |
| --- | --- |
| `final-results-20260928.py`, `final-results-20260928*.csv`, `.md`, `-evidence.json` | Per-trial and per-Judge results, descriptive summaries, usage accounting, source hashes, and requirement links |
| `co-construction-requirement-coverage.py` | Shared calculation of unique requirements with corrective or explicitly accepting contributions |
| `r3-5-analysis.py`, `r3-5-analysis-results.csv`, `-pairs.csv`, `-results.md`, `-evidence.json` | All 16 exact paired permutation tests, paired trial identities, Holm-adjusted p-values, and input/output hashes |
| `r3-5-analysis-plan.md` | Preserved exploratory analysis plan written after inspecting descriptive results; not a preregistration |
| `requirement-agreement.py`, `.json`, `.md` | Requirement-level agreement, Cohen's kappa, confusion matrices, and all 4,800 trial/requirement pairs |
| `additional-results-blocks-03-04-20260926-runs.csv` | Historical 120-trial aggregate used solely to check that extending to 150 trials preserved 960 earlier values |

The scripts were originally used in the manuscript workspace. Their repository
paths have been adapted for this standalone archive; the calculations and
frozen numerical results are unchanged. Dated reports and the analysis plan
retain the history of the analysis, including manuscript-editing notes. Their
references to earlier stages do not describe the current publication status.
Source hashes in regenerated evidence files use paths relative to this
repository, rather than the former manuscript workspace.

## Scope

- Final analysis uses Claude and Codex only. Any earlier Gemini call records
  retained in the raw archives are not included in these results.
- Means and sample standard deviations summarize trials. The two Judges are
  reported separately, not counted as additional independent trials.
- The 16 tests cover four contrasts, two reference-requirement groups, and two
  Judges. Pairs match repetition block, model pair, and Maker effort; Holm
  correction covers all 16 tests. These are exploratory analyses.
- Agreement is measured per trial and reference requirement, not per dialogue
  decision. It does not establish the correctness of either Judge.
- The reference has 22 core and 10 extended requirements. Explicit acceptance
  of a divergence can count as a contribution without reference-conforming
  implementation; implementation coverage is assessed separately.

For a separate audit of all captured requirement links, the shared calculation
script can also be run directly. Its default covers all five repetition blocks:

```sh
python3 analysis/co-construction-requirement-coverage.py --output-dir /tmp/cospec-requirement-links
```
