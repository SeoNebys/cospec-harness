# COSPEC comparison harness

An automated harness that runs the COSPEC comparison experiment — vibe coding,
SDD, and COSPEC across satisficing/diligent engagement — with the human relay
replaced by a program. Two LLM agents (a **maker** and a reference-anchored
**director**) run headless in Docker; a **broker** relays between them verbatim,
logs every utterance, and a blind **judge** scores coverage afterwards. The
reported experiment used `claude-opus-4-8` for all three LLM roles.

> This is the English, fully automated dataset reported in the thesis comparison
> chapter. It is an LLM-role-based exploratory evaluation, not a human-user
> study. See "Validity notes" below.

## Roles

| Role | Kind | Model in reported runs | Config (CLAUDE.md) | Sees reference spec? |
|---|---|---|---|---|
| **maker** | LLM agent (`claude -p`) | `claude-opus-4-8` | `method-configs/<method>/` | No (information asymmetry) |
| **director** | LLM agent (`claude -p`) | `claude-opus-4-8` | `director-configs/<engagement>/` | Yes (`/oracle`, read-only) |
| **judge** | LLM agent, post-hoc | `claude-opus-4-8` | `judge-configs/` | Yes; blind to method/log |
| **broker** | program (`scripts/broker.py`) | — | — (deliberately non-agentic) | Enforces asymmetry |

The broker is a mechanical relay: the director's utterance is passed to the
maker **verbatim** (raw == relayed). It never composes reaction content.

## Conditions

`config/conditions.yaml`. Five conditions = method × engagement:

| ID | method | engagement |
|----|--------|------------|
| VC   | vibe   | satisficing |
| SD-S | sdd    | satisficing |
| SD-D | sdd    | diligent |
| CO-S | cospec | satisficing |
| CO-D | cospec | diligent |

## Layout

```
config/            conditions.yaml, run-plan.yaml, initial-prompt.txt
docker/            shared agent image (claude CLI + node + uv)
method-configs/    maker seed — cospec/ only (vibe=empty, sdd=`specify init`)
director-configs/  director seed per engagement (satisficing/, diligent/)
judge-configs/     blind judge seed
oracle/            reference-spec.md + rubrics/  (RO into director/judge; never maker)
scripts/           harness.py, setup.py, teardown.py, broker.py,
                   render_preview.py, judge.py, aggregate.py,
                   audit_statistics.py, transcript.py
analysis/          derived validation and descriptive statistics
runs/<ID>/run-NN/  archived: maker-workspace, transcripts, presentation, broker-log.json, meta.json
_work/             runtime working area (gitignored; recreated per run)
```

## Quickstart

```bash
# 1. build the shared agent image
docker build -t cospec-harness-env docker/

# 2. deps (broker runs on the host)
pip install -r requirements.txt && playwright install chromium

# 3. copy .env.example to .env and set ONE authentication method
cp .env.example .env
# ANTHROPIC_API_KEY=sk-ant-...                    # Console pay-per-token, OR:
# CLAUDE_CODE_OAUTH_TOKEN=<token>                 # Pro/Max subscription token
# HARNESS_MODEL=claude-opus-4-8                   # maker, director, and judge
# The broker forwards whichever of the two is set into the containers. Set only
# one: if both are present the API key wins and a subscription batch will fail.
# Subscriptions have rolling session/weekly quotas — a large batch may exhaust
# them; set CLAUDE_CODE_RETRY_WATCHDOG=1 to wait out capacity (429/529) errors.

# 4. run the batch defined in config/run-plan.yaml
python scripts/broker.py

#    ...or a single ad-hoc run / a few trials of one condition
python scripts/broker.py CO-D --trials 3

# 5. blind coverage scoring (post-hoc) + primary aggregate table
python scripts/judge.py runs/CO-D/run-01
python scripts/aggregate.py

# 6. validate all N_g judgments and regenerate descriptive/sensitivity results
python scripts/audit_statistics.py
```

`scripts/setup.py <ID>` / `scripts/teardown.py` are manual single-run wrappers
around the same `harness` functions the broker calls.

## Run plan

`config/run-plan.yaml` controls order and repetition:

- `order: interleaved` — one cycle = one run of each condition, repeated `repeat`×.
- `order: blocked` — all repeats of a condition together.
- `order: sequence` — a literal execution list.
- `resume: true` — count existing `runs/<ID>/` and only run the shortfall
  (idempotent; safe to re-run after a crash).
- `shuffle` / `seed`, `max_rounds`, `keep_going`.

Each run is fully isolated: fresh containers and transcripts, wiped on teardown —
so no memory leaks between runs or conditions.

The declared primary analysis contains the first five archived runs of every
condition. A supplemental `CO-D/run-06` was executed after `CO-D/run-03`
encountered a prolonged implementation-delivery detour. The run-03 metadata
nevertheless records `terminated: converged`, so it remains in the predeclared
five-run primary set. The supplemental run is retained and reported only in the
sensitivity analysis under `analysis/`.

The archived primary runs' `archived_at` timestamps do not reproduce the current
interleaved condition order literally. The primary analysis is therefore defined
by run identity—the first five archived runs of each condition—not by timestamp
order.

`scripts/aggregate.py` therefore honors the primary run-count policy in
`run-plan.yaml` by default. Pass `--run-policy all` to include every archived run.
The archived LLM transcript
entries identify the substantive model as `claude-opus-4-8` and the Claude Code
runner version as `2.1.197`; synthetic harness entries are marked `<synthetic>`.

## Reproducibility scope

The archived `runs/` directories and judgments are the immutable source records
for the reported analysis. `scripts/audit_statistics.py` regenerates the derived
files under `analysis/` without modifying those archives. The Docker image pins
Claude Code `2.1.197`, matching the runner version recorded in the transcripts,
and `requirements.txt` pins the host-side Python packages used by the release.

Fresh executions still depend on the availability and behavior of the hosted LLM
identified by `HARNESS_MODEL`; exact output replication is therefore not expected.
The archived records, judgments, and derived statistics are included so the
reported calculations can be inspected without rerunning the LLM experiment.

## Session model

Per round: maker speaks → broker curates the **presentation** the client may see
→ director reacts → broker relays verbatim. The director ends a session with
`[[TERMINATE:converged]]` or `[[TERMINATE:stalled]]`.

Presentation curation (`scripts/broker.py::curate`) is method-specific and
enforces each method's interaction model — notably COSPEC's internal Gherkin
(`context/`) is **never** exposed to the client; only prototype UI is.

## Validity notes

- Automating the relay removes the relay-fidelity concern (raw == relayed) and
  the self-reference concern (a separate blind judge scores coverage).
- What automation does **not** remove: (a) the policy-authorship bias — the
  reference spec and director policies are written by the framework designer;
  (b) an LLM director *reads* a rendered prototype rather than *using* it, so
  COSPEC's "only-by-using-it" experiential discovery is under-reproduced.
- The per-turn content load (chunk size) is measured objectively, but "cognitive
  cost" is a human interpretation not directly modelled by an LLM client. Treat
  these automated runs as exploratory evidence about text-interaction patterns,
  coverage, and co-construction opportunities. Human cognitive load, usability,
  and engagement effects remain untested.

## Citation

Citation metadata is provided in `CITATION.cff`. The archived v1.0.1 release is
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
