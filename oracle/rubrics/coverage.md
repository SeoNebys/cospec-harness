# Coverage rubric

Used by the blind judge (judge-configs/CLAUDE.md) to score an implementation
against reference-spec.md.

## Unit and verdicts

For each `REF-BM-###`, assign one verdict from the code and its behaviour:

- **present** — the requirement is fully realised, including any boundary rule
  stated in the item (e.g. REF-BM-06 must actually converge a duplicate url to
  editing the existing bookmark, not merely save it).
- **partial** — the primary behaviour exists but a stated sub-rule or facet is
  missing or wrong (e.g. search works but is case-sensitive, violating REF-BM-13;
  or snapshot saves HTML but does not handle the PDF rule of REF-BM-24).
- **absent** — not realised, or only stubbed / mentioned in docs without working code.

## Rules

- Judge from **code and observable behaviour**, not comments, TODOs, or specs.
- Direction is one-way (reference -> implementation). Do **not** score or reward
  features the implementation added beyond the reference.
- Score **core** (REF-BM-01..22) and **extended** (REF-BM-23..32) separately.
- **Infra** items (REF-BM-I01..I05) are excluded from the denominator entirely.
- The judge is blind: it does not know the method, engagement, or transcript.

## Reporting

Coverage % = (present + 0.5 × partial) / denominator, reported separately for
core (/22) and extended (/10). See scripts/aggregate.py.
