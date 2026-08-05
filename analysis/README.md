# Derived experiment analysis

This directory contains derived, reproducible analysis artifacts. Files under
`runs/` are treated as immutable raw archives.

- `ng-adjudication-addendum.json` records a missing decision detail that can be
  reconstructed from the original judgment and broker log without changing the
  raw `ng-judgment.json`.
- `ng-validation.json` records per-run consistency checks and opportunity-based
  catch rates.
- `experiment-statistics.json` contains machine-readable descriptive results.
- `experiment-statistics.md` contains the same results in a reviewable table.

Regenerate the derived files from the harness root:

```bash
python scripts/audit_statistics.py
```

The primary analysis follows `config/run-plan.yaml`: five planned runs per
condition. `CO-D/run-06` is retained as a supplemental run and is included in
the sensitivity analyses.
