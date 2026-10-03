# COSPEC comparison harness

An automated experiment harness for comparing vibe coding, specification-driven
development (SDD), and COSPEC. LLM agents act as Maker and Director, while a
programmatic Broker relays their messages and presents artifacts. Independent
Claude and Codex Judges assess implementation coverage and co-construction after
each trial. This is an exploratory evaluation with LLM roles, not a human-user
study.

## Roles and models

| Role | Responsibility | Model | Reference specification |
| --- | --- | --- | --- |
| Maker | Develops the software using the assigned method | Claude Opus 4.8 or Codex `gpt-5.6-sol` | Not provided |
| Director | Performs the client role under the assigned engagement policy | The other model in the pair | Read-only |
| Judge | Evaluates coverage and co-construction in separate executions | Claude Opus 4.8 and Codex `gpt-5.6-sol`, independently | Read-only |
| Broker | Relays dialogue, delivers artifacts, and records execution | Program | Not used to compose responses |

Model identifiers and default settings are in [config/llm.yaml](config/llm.yaml).
The research schedule uses both cross-model pairs: Claude Maker with Codex
Director, and Codex Maker with Claude Director. Maker effort varies across low,
medium, and high; Director effort stays medium and Judge effort stays high.
Effort labels are service-specific settings, not equivalent amounts of reasoning
across models.

Coverage judging uses implementation artifacts; co-construction judging uses
the dialogue. Each Judge works independently without seeing the other Judge's
results. Method labels and run metadata are withheld from Judge inputs, although
artifacts or dialogue may reveal aspects of the method.

## Conditions and schedule

[config/conditions.yaml](config/conditions.yaml) defines five conditions:

| ID | Method | Director engagement |
| --- | --- | --- |
| VC | Vibe coding | Satisficing |
| SD-S | SDD using GitHub Spec Kit | Satisficing |
| SD-D | SDD using GitHub Spec Kit | Diligent |
| CO-S | COSPEC | Satisficing |
| CO-D | COSPEC | Diligent |

Five conditions × two model pairs × three Maker effort levels give 30
combinations. Each combination is scheduled five times, for 150 trials.
[config/trial-schedule.csv](config/trial-schedule.csv) stores the fixed execution
order, randomized within each 30-trial block using seed 42. The runner does not
reshuffle when restarted. [config/run-plan.yaml](config/run-plan.yaml) records
the schedule settings, quota thresholds, and round limit.

## Layout

```text
config/            conditions, models, fixed schedule, initial prompt, runtime rules
method-configs/    COSPEC Maker instructions (SDD is initialized with Spec Kit)
director-configs/  satisficing and diligent Director instructions
judge-configs/     Judge instructions
oracle/            reference specification and rubrics; never mounted for Maker
docker/            shared agent image and operational documentation
scripts/           execution, authentication, judging, and analysis utilities
analysis/          final 150-trial summaries, statistical tests, and Judge agreement
runs/              execution-state.json and condition-specific run archives
  <ID>/run-NN/     workspaces, dialogue, presentation, metadata, and call records
    judgments/     independent claude/ and codex/ judgments
_work/             temporary execution workspace (ignored by Git)
backup/            previous data retained locally (ignored by Git)
pilots/            local validation records, when present (ignored by Git)
```

Run numbers are assigned within each condition. Schedule identities and model
settings are recorded in execution state and run metadata; do not infer the
model pair or effort from the run number alone.

## Quickstart

Run these commands from the repository root on a Linux host with Docker and
Python 3.11 or later. The host also needs authenticated Claude and Codex CLIs.
The harness uses their existing subscription credentials; model calls consume
those subscriptions' allowances.

```sh
# Build the shared agent image.
docker build --build-arg HOST_UID="$(id -u)" --build-arg HOST_GID="$(id -g)" \
  -t cospec-harness-env docker/

# Install host dependencies and Chromium, including Linux browser dependencies.
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m playwright install --with-deps chromium

# Check saved login formats without model requests or printing credentials.
.venv/bin/python scripts/subscription_auth.py check claude
.venv/bin/python scripts/subscription_auth.py check codex

# Inspect the first block without starting containers or making model calls.
.venv/bin/python scripts/run_matrix.py --block 1 --dry-run

# Execute 30 trials, then evaluate them with both Judges in both modes.
.venv/bin/python -u scripts/run_matrix.py --block 1
.venv/bin/python -u scripts/run_matrix.py --judge-block 1

# Start the next block after judging finishes; repeat through block 5.
.venv/bin/python -u scripts/run_matrix.py --block 2
```

See [subscription authentication](docker/authentication.md) for credential
locations and refresh handling. [.env.example](.env.example) contains optional
local settings; copying it is not required for the default subscription mode.
If a local `.env` already exists, remove `HARNESS_MODEL`: models are selected
through `config/llm.yaml` and the schedule. The code rejects this old variable.
Never commit populated credentials.

The default Broker entry point (`scripts/broker.py`) still supports ad-hoc,
condition-only runs. It does not execute the 150-trial research schedule.
Use [block execution](docker/batch-execution.md) for the research workflow and
[model configuration](docker/models.md) for individual role and Judge commands.

## Execution and acceptance

Before each trial or judgment, the runner checks subscription allowances. The
configured minimum remaining allowances are 20% for Maker, 10% for Director,
and 5% for Judge. These are operating margins, not guarantees that a task will
finish within the remaining allowance. A preflight stop leaves pending work
available for a later invocation. An interrupted trial preserves its evidence
and requires inspection; restarting is not an unconditional retry of failed work.

Each block stops after its scheduled trials and again after judging. Both Judges'
valid coverage and co-construction results are required before advancing to the
next block. Inputs and image identity are recorded to detect changes during
execution; see [block execution](docker/batch-execution.md) for recovery rules.

During a round, Maker presents its work, Broker delivers the relevant artifacts,
and Director responds. Broker relays Director's dialogue without rewriting it;
control tags are recorded separately. COSPEC delivers prototype files and images
while withholding internal GWT specifications. SDD delivers specification and
planning documents. Running applications can be accessed through the declared
HTTP endpoint, and Director can interact with them using browser tools. See
[artifact presentation](docker/presentation.md).

Director appends `<FINAL_ACCEPTED>` when accepting the complete implementation.
The Broker recognizes this signal with a declared application; approving a
prototype or specification alone does not end the trial. Acceptance does not
assert complete reference-specification coverage. Without acceptance, execution
continues until an error or the configured 80-round cap. The default 180-minute
timeout applies to each model call, not to the whole trial.

## Data and analysis scope

This revision includes the execution framework, instructions, fixed schedule,
all 150 completed trial archives, and 600 final Claude/Codex judgments (two
models × two measures × 150 trials). The final analysis scripts and derived
results are in [analysis/](analysis/README.md). Earlier experimental data remain
available in Git history and the archived v1.0.1 release linked below. A local
`backup/` directory is not part of the published repository.

New judgments use this layout:

```text
runs/<ID>/run-NN/judgments/<claude|codex>/
  judgment.json       # implementation coverage
  ng-judgment.json    # co-construction
```

`scripts/aggregate.py` and `scripts/audit_statistics.py` retain the earlier
root-level judgment layout and condition-only run-count policy. They are not
the final analysis pipeline for the 150-trial, two-Judge dataset. Do not use
their default output as a summary of the new experiment. To reproduce the final
summaries, 16 paired permutation tests with Holm correction, and requirement-level
Judge agreement, run the following from this repository root with Python 3.11+:

```sh
python3 analysis/final-results-20260928.py
python3 analysis/r3-5-analysis.py
python3 analysis/requirement-agreement.py
```

These commands use only the Python standard library, do not call any LLM, and
do not change the archived run records or Judge decisions. They regenerate
analysis files in `analysis/`. See [analysis/README.md](analysis/README.md) for
the output inventory and interpretation limits. Regenerable dependency and build
directories are excluded from archived workspaces as specified in `.gitignore`;
source code, lockfiles, dialogue, presented artifacts, and final judgments are
retained.

`scripts/resource_report.py` summarizes recorded execution time and available
token usage; see [resource measurement](docker/batch-execution.md#resource-measurement).
Token counts are observed usage, not subscription allowance or billed charges.

## Reproducibility and validation

[Docker documentation](docker/README.md) records pinned tool versions and build
checks. Each run records its actual model settings and image identity. The
2026-10-03 rebuild is distinct from the image used for the completed experiment;
rebuilding the environment does not regenerate or update archived results.
Hosted model availability and behavior can change, so identical outputs are not
expected from fresh executions.

For local checks without model calls:

```sh
.venv/bin/python -m unittest discover -s scripts -p 'test_*.py'
.venv/bin/python scripts/run_matrix.py --block 1 --dry-run
```

On 2026-10-03, 142 offline tests and the first-block schedule dry-run passed.
The rebuilt image also passed tool and Python/Node Chromium interaction checks
without credentials or model requests.

## Validity notes

The reference specification and role instructions define the simulated client's
expectations and engagement. Their authorship and the use of LLM clients limit
generalization to people. Browser interaction is supported, but this does not
reproduce human experience or measure cognitive load, usability, or engagement.
Independent Judges can also disagree; retain their results separately rather
than treating either as ground truth. These experiments examine interaction,
coverage, and co-construction under the configured conditions.

## Citation

Citation metadata is provided in `CITATION.cff`. Version v2.0.0 contains the
complete 150-trial dataset and final analyses. Its version-specific DOI will be
linked from the [v2.0.0 release](https://github.com/SeoNebys/cospec-harness/releases/tag/v2.0.0).
The archive across all versions is available at
<https://doi.org/10.5281/zenodo.21803279>. The earlier v1.0.1 dataset remains
available at <https://doi.org/10.5281/zenodo.21803280>.

Source repository: <https://github.com/SeoNebys/cospec-harness>

Third-party materials preserved inside the archived SDD workspaces are identified
in `THIRD_PARTY_NOTICES.md` and remain under their respective licenses.

## License and contributions

Original software is released under the MIT License. Original research data and
documentation are released under the Creative Commons Attribution 4.0
International License (CC BY 4.0). See `LICENSE` for the scope of each license.

Yongjin Seo created and maintains this research artifact. Hyeon Soo Kim supervised
the associated research and is a co-author of the related article; that article
will be linked from the citation metadata when its DOI becomes available.
