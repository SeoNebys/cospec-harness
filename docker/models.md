# Models and role execution

`config/llm.yaml` fixes provider, model and reasoning effort. Satisficing and
diligent conditions use the same configuration within each role.

| Service | Model | Maker | Director | Judge |
| --- | --- | --- | --- | --- |
| Claude | `claude-opus-4-8` | high | medium | high |
| Codex | `gpt-5.6-sol` | medium | medium | high |

These effort labels are provider-specific settings, not a claim that the same
label means identical reasoning compute across services. `HARNESS_MODEL` is
rejected to avoid accidentally selecting one service's model for every role.

## Maker and Director

Commands below run from `experiment/`. A provider pair can be selected explicitly:

```sh
python scripts/broker.py CO-S --maker claude --director codex --dry-run
python scripts/broker.py CO-S --maker claude --director codex
```

All four Claude/Codex combinations are supported, including same-model pairs.
Without `--maker`/`--director`, the defaults in `llm.yaml` apply. Omitting the
condition uses the existing run-plan for the selected pair. This change does not
expand that plan into balanced 20-run blocks; that scheduler remains a separate
step before the 100-run experiment.

Resume counts only completed runs with matching Maker/Director model and effort
metadata. Legacy runs, other pairs and interrupted/capped runs do not satisfy the
selected pair's target. New runs retain the existing sequential `run-NN` naming.
This is batch shortfall handling; it does not reconstruct a crashed Broker's
partly completed turn. In-session continuation uses explicit CLI session IDs.

Runtime policies keep their content and use the CLI's entry filename:

- Claude: `CLAUDE.md`.
- Codex: `AGENTS.md`; SDD skill references point to `.agents/skills/`.

Source policy files remain unchanged. COSPEC's supporting `.claude/*.md` files
are still referenced as documents by Codex. SpecKit initializes the chosen
Maker integration with Linux shell scripts. The Maker never mounts `/oracle`.

Claude sessions use the existing transcript mount. Codex sessions are mounted
from its `sessions` directory. Broker calls are also recorded under
`session/calls/<role>/`; successful records include native stdout, normalized
usage, requested settings, session ID and retry counts. `meta.json` records the
model pair and image ID. Native model identifiers are retained where the CLI
reports them; requested settings are not presented as observed identifiers.

## Two independent Judges

```sh
python scripts/judge.py runs/CO-S/run-01 --mode coverage --judge all
python scripts/judge.py runs/CO-S/run-01 --mode co-construction --judge all
```

`--judge all` is the default and runs the configured judges sequentially. Use
`--judge claude` or `--judge codex` for one service. These commands perform real
judging; they are not part of the installation check.

Results are kept independently:

```text
runs/<condition>/run-NN/judgments/<claude|codex>/
  judgment.json
  ng-judgment.json
  coverage-calls/call-0001.json
  co-construction-calls/call-0001.json
```

Each service and mode starts a fresh Judge container. Coverage sees only the
implementation and oracle; co-construction sees only the broker transcript and
oracle. Neither sees run metadata, another Judge's result, or the method name
through the host path. Model metadata is added to the saved result afterwards.
Existing result files are not overwritten automatically. Legacy root-level
judgments and aggregate reports remain unchanged; combining the two Judges and
human ratings is a separate analysis step.

## Responses, tokens and failures

`scripts/llm.py` handles Claude JSON and Codex JSONL and returns
a common response. It resumes the exact session/thread ID, never
the most recent unrelated session. Quota retries retain any newly created ID;
authentication failures and tool permission failures do not trigger quota waits
or switch services/models. Requests and quota waits emit periodic progress.

Normalized `input_tokens` excludes cached reads. Codex native input totals include cached reads, so those are split out; the native usage is
also retained. Thinking counts are kept separately when reported and must not
be added to output totals without considering the provider's accounting rules.
Claude's reported dollar estimate is retained as CLI metadata, not a claim of
additional API billing on a subscription.

## Validation

Automated tests cover response/session parsing, errors inside successful CLI
processes, quota classification, policy-path conversion and
pair-aware resume counts, together with the authentication and rubric tests.

On the current VM, all four pair setups and both SpecKit integrations were
checked using temporary workspaces. Small live fixtures exercise file-based
judging and conversation continuation. These checks use low effort and do not
replace a full COSPEC/SDD/VC experimental run or validate research outcomes.

Validation completed on 2026-09-14:

- 24 automated tests passed, including the existing rubric tests.
- Four COSPEC pair setups passed; Maker isolation from the oracle was checked.
- Claude and Codex SpecKit setup and skill paths passed.
- Claude and Codex each read a small implementation/reference fixture,
  returned a judgment, then resumed the same session and recalled its content.
- No full experimental run or regrading of archived research data was performed.
