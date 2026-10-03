# Research execution in blocks of 30

The frozen `config/trial-schedule.csv` contains 150 trials: five blocks of
30 combinations. Each block contains both cross-model Maker/Director pairs,
all three Maker effort settings, and all five conditions exactly once. Director
effort stays medium. `config/run-plan.yaml` records generation rules and start
thresholds. The runner reads the saved order; it never regenerates or shuffles it.

From `experiment/`, inspect a block without Docker, authentication, model calls,
or execution-state changes:

```sh
.venv/bin/python scripts/run_matrix.py --block 1 --dry-run
```

Execute only the first block:

```sh
.venv/bin/python -u scripts/run_matrix.py --block 1
```

Re-running the same command after a preflight quota stop continues from the
first pending trial. Completed and capped trials are not repeated. Once all
30 scheduled trials are archived, the process exits with `awaiting_judge`.
The count is scheduled attempts, not 30 successful acceptances. An in-trial
failure stops the queue and retains evidence; it is never reset to pending or
silently replaced. Inspect interrupted work before deciding how to handle it.
Starting a later block requires valid completed judgments for preceding blocks.

Run coverage and co-construction judging with the required Judges, Claude and Codex:

```sh
.venv/bin/python -u scripts/run_matrix.py --judge-block 1
```

Claude and Codex allowances are checked before each judgment. Both are required
for block completion. Judge errors stop the queue with call records preserved.
Restarting skips only valid results from the pinned model and image; invalid
results or an interrupted call without a finished result require inspection,
not automatic replay. Coverage must contain all 32 functional items with valid
verdicts; co-construction totals are checked against its decisions.
30 trials × 2 required Judges × 2 modes require 120 judgment tasks per block.
Historical records from an inactive Judge remain preserved in the archives and
execution state, but are not included in the required tasks or final analysis.

After all required judgments are valid, the process exits with
`ready_for_next_block`. Start the next block explicitly:

```sh
.venv/bin/python -u scripts/run_matrix.py --block 2
```

Human assessment can proceed separately and is not a gate for this command.
Judge findings never feed back into Maker/Director prompts or change the saved
execution order. Do not change experimental inputs between trials or blocks.
Input fingerprints include configurations, policies, rubrics, scripts, Judge
instructions and Docker files; changed inputs stop the queue. The actual Docker
image ID and role models are pinned in execution state.

## Subscription allowance checks

Before starting a trial, query both providers using the authoritative VM login.
No inference prompt is sent by the lookup. Codex uses the official App Server
`account/rateLimits/read` method. Claude uses the subscription usage endpoint
used by Claude Code; its availability and response shape are not a guaranteed
public API. Authentication expiry, a failed query, a missing required window,
invalid values, or stale readings block new work. No authentication data or raw
HTTP/RPC errors are written to research records.

`quota_check` in `config/run-plan.yaml` sets a provisional minimum remaining
allowance of 20% for Maker, 10% for Director, and 5% for Judge. The threshold
follows the provider's role in the scheduled task: Claude Maker / Codex Director
requires 20% from Claude and 10% from Codex; reversing the roles reverses these
thresholds. The log records the role and applied threshold for each check.
These are operating margins,
not a token-to-quota conversion or a guarantee of completing a trial. Every
returned relevant window must meet the margin. Claude requires 5-hour and weekly
windows and checks an Opus-specific weekly window if returned. Codex requires the
weekly pool and checks other windows in that same pool if returned; an absent
short window remains unknown, never an inferred 100% allowance. Spark's separate
pool is not used. Readings expire after 120 seconds and after their reset time.

If a check blocks, the process exits normally with `waiting_for_quota`; the next
trial remains pending without a start timestamp or new session. Run the same
block command again after allowance becomes available. It re-queries the services
and keeps the original order. The runner does not switch models, lower effort,
skip an expensive condition, or automatically purchase additional usage.
In-trial quota errors retain the existing interruption policy: stop and preserve
evidence. Only preflight stops are automatically continuable by the same command.

## Evidence locations

- `config/trial-schedule.csv`: immutable planned sequence, without live statuses.
- `runs/execution-state.json`: trial and block statuses, model/image/input identity,
  quota decisions, resource summaries, and Judge progress.
- `runs/quota-checks.jsonl`: append-only allowance checks and manual confirmations.
- `runs/resource-usage.json` and `.md`: recorded experiment time and token usage.
- `runs/<condition>/run-NN/`: ordinary archives; `meta.json` and
  `session/trial.json` link each archive to its trial ID, order and block.
- `runs/<condition>/run-NN/judgments/<provider>/`: judgment results and call-level
  usage/timing records, separate from the Maker/Director totals.
- `_work/`: active work and operation timing, excluded from Git.

No `batches/` directory is created. Completed evidence survives process restarts.
At most one trial or Judge queue runs at a time, under the same lock. Existing
role containers and unfinished workspaces are never overwritten. The 80-round
limit applies per dialogue, while 180 minutes is the limit per model call, not
per trial. Final acceptance, capped trials, and infrastructure failures remain
distinct outcomes.

## Validation and historical matrices

`scripts/run_matrix.py` schedules one block: five conditions × four ordered
Maker/Director pairs = 20 attempts. Each attempt starts independently. Earlier
pilots and legacy runs are not counted. Conditions remain VC-S, SDD-S, SDD-D,
COSPEC-S and COSPEC-D (internal IDs VC, SD-S, SD-D, CO-S and CO-D).

The order is shuffled once with seed 42 and recorded in `status.json`. Each
role uses the model and effort in `config/llm.yaml`. The default limit is 80 rounds; `--max-rounds` can explicitly override it for a
separately configured batch. New trials use the final-acceptance protocol described in
[presentation.md](presentation.md). Reaching the limit is recorded as
`capped`, separately from final acceptance (`completed`). Unchanged artifacts do
not stop new trials. Historical `incomplete` and `needs_verification` outcomes are
preserved; new trials do not produce them. No automatic replacement trial is scheduled.
Final acceptance does not establish reference-spec coverage.
Judge calls are not included.

From `experiment/`:

```sh
.venv/bin/python scripts/run_matrix.py --batch-dir pilots/block-01 --dry-run
.venv/bin/python -u scripts/run_matrix.py --batch-dir pilots/block-01
```

For a fresh verification batch containing one trial per condition with only
Codex Maker / Claude Director and an 80-round limit:

```sh
.venv/bin/python -u scripts/run_matrix.py --batch-dir pilots/conditions-codex-claude-next \
  --maker codex --director claude --max-rounds 80 --validation
```

The five-trial subset is marked as verification and excluded from research runs.
Model efforts still come from `config/llm.yaml`. The limit override is recorded
in the new batch; existing batch settings and results are not changed.

The batch directory contains `status.json`, an input snapshot under `inputs/`,
archived trials under `runs/`, and the active trial under `_work/`. The Docker
image is pinned by its ID. Input changes stop the queue before its next trial.
A shared file lock prevents overlapping matrix runners; existing role containers
are checked before setup. Do not run another Broker or modify inputs during a block.

Archives are copied to a staging directory with symbolic links preserved without
dereferencing. The finished directory is published only after copying succeeds,
with `archive-complete.json`. Earlier partial archives are retained separately;
they are not merged into the new copy. The Director workspace is archived along
with the other evidence. A completed dialogue's summary is saved in batch status
before archiving, so a copy failure is recorded as `archive_failed`.

To recover only the archive of an already-finished dialogue:

```sh
.venv/bin/python scripts/run_matrix.py --batch-dir pilots/block-01 --archive-only
```

This validates the saved dialogue metadata against the original batch, copies
the evidence, and updates the archive status. It does not call models, resume
the queue, remove role containers, or clear the active workspace. Original input
fingerprints remain unchanged even if policies have since been edited; this
recovery is not permission to continue the old batch with new policies.

Application defects continue to client review within the original round and time
limits. They do not grant extra implementation attempts outside the dialogue.
Presentation environment errors retry only the same completed Maker response
(default: at most 3 attempts, 10 seconds apart). Configure this rule before a
block and apply it equally to every condition. Attempt records preserve the
actual limits, elapsed time and failures.

New trials record `interruption: stop` in `session/control.json`. Exhausted
presentation retries, model-call failures, quota failures, and timeouts stop the
queue with available workspace/transcripts preserved. `--resume-session` is
rejected for these trials. The generic CLI wrapper cannot prove that a failed
model call performed no work, so it does not automatically repeat the prompt.
An interrupted trial is retained as `paused` (presentation) or `failed` (other
errors); neither counts as completed. Do not reset these records to pending.

After diagnosing the cause, any authorized rerun starts independently in a new
batch directory with a new identity. Record the original trial, interruption
reason, environment changes and replacement trial in the work report. Do not
delete the interrupted attempt or merge its dialogue with the replacement.
Existing role containers and the active workspace must be preserved/archived
before any cleanup; the runner will not overwrite them automatically.

Legacy sessions without the interruption policy retain the old explicit
presentation-resume path and quota waiting behavior (15-minute intervals, up to
24 hours per call). This compatibility path does not authorize applying it to
new trials. Previous recovered pilots remain verification attempts and must be
described as interrupted/recovered, rather than continuously executed trials.
Archive-only recovery above is still supported: it copies an already-finished
dialogue without additional model work.

This VM's `.env` sets `HARNESS_CALL_TIMEOUT=10800` (180 minutes) for each CLI
invocation; the shell environment takes precedence. The source fallback remains
10800 seconds when absent. This is a per-call limit, not a whole-trial limit.
VM power-off stops execution; disconnecting a terminal does not stop a separately
launched background process.

## Resource measurement

Every new CLI attempt records UTC start/end timestamps, monotonic elapsed time,
outcome, available usage and workspace phase observations in
`session/calls/<role>/attempts/`. Failed and timed-out calls are retained even
when no dialogue response is produced. Unknown usage is marked explicitly.
Successful `call-NNNN.json` and Broker dialogue usage contain additive per-call
usage; raw provider counters are preserved separately.

Codex usage is the increment between native thread counters before and after a
call. Child threads are counted once by their own session IDs, excluding inherited
history. Counter increments are checked against native last-request usage before
combining thread totals. A reset or missing resumed-session baseline is marked
unresolved, never treated as a fresh full counter. Claude uses the CLI modelUsage
breakdown, including auxiliary models; interrupted native message usage is a
fallback with an explicit completeness limitation. Reasoning tokens are an output
subset and are not added to output tokens again. These values are observed usage,
not subscription quota or billed charges.

Broker records Maker turns, Director turns and presentation time. The matrix
records setup, dialogue and archive time under `timing/trial-NNN/`. Presentation
attempts and retry waits retain their existing detailed records. Legacy quota
waits are timed separately. Start records remain identifiable if the host stops
before an end record can be written; their duration is unknown, not zero.

The batch writes `resource-usage.json` and `.md` on completion or handled failure.
To refresh a running batch or recalculate archived evidence without changing raw
records:

```sh
.venv/bin/python scripts/resource_report.py --batch-dir pilots/block-01
```

`--output /path/to/report.json` writes a separate JSON/Markdown report. Old
usage-summary files and frozen inputs are not rewritten. For old Codex runs, use
the recalculated report rather than the previous sum of cumulative counters.

The report separates total elapsed time from recorded interruption gaps. Model
attempt and presentation times are parts of dialogue time; never add these
layers together. Failed work counts toward resource consumption. Parallel child
agent durations are not added to wall time. Final dialogue and protocol overhead
remain in the resource total; the older aggregate.py dialogue-tail convention
does not trim this report.

Phase labels describe observed state/artifacts before and after a call. A change
is marked transition_or_mixed. They do not claim exact within-call specification,
implementation or testing durations. Historical missing detail remains unknown;
provider duration_ms/API-duration fields are preserved as separate observations,
not substituted for end-to-end elapsed time.
