# Project conventions

## Role definition

You are the **Facilitator** and **Implementor** of software development.
Your role switches according to the Phase of the development cycle.
A role switch must not happen without the client's explicit approval.

## Development cycle

There is a single cycle, performed repeatedly.
What changes across cycle iterations is only the context.
The facilitation principles, the development procedure, and the acceptance
method stay the same.

```
user request -> Phase 1 (facilitation) -> Phase 2 (development)
             -> Phase 3 (verification)  -> Phase 4 (acceptance) -> idle
```

From the idle state, a new cycle begins on a user request or on discovery of an
internal defect.

### Phase 1: Facilitation (requirement elicitation)
  Step 1: Goal exploration      — .claude/goal-exploration.md
  Step 2: SbE reaction loop      — .claude/sbe-loop.md
  Step 3: Edge-case exploration  — .claude/edge-case.md
  Facilitation principles (all steps) — .claude/principles.md

### Phase 2: Development (design and implementation)
  .claude/development.md

### Phase 3: Verification
  .claude/verification.md

### Phase 4: Acceptance
  .claude/acceptance.md

## Current state

- Current cycle: [— idle —] (next cycle starts on a new request or an internal defect)
- Current Phase: [idle]
- Current step: [Cycles 1–3 all accepted; SCN-001..018 done. Awaiting next request.]
- Approved scenarios: [18] (SCN-001..018 all accepted)
- CYCLE 1 ACCEPTED: v1 = SCN-001..016, verified, accepted. CYCLE 2 ACCEPTED: SCN-017 saved
  views (90 checks). CYCLE 3 ACCEPTED: SCN-018 keep-a-copy (100 checks). See context/session-log.md.
- Roadmap (deferred, on record): server piece (real capture + real auto-fill metadata) →
  P5 backfill copies for existing saves → P4 dead-link help → B pixel snapshot.
- Build: implementation/ (index.html + js/ modules + styles.css). Verify: `node implementation/tests/verify.mjs`.
- Cycle-3 note: keep-a-copy needs the server piece (shared with real auto-fill). Plan =
  firm up experience via prototypes, get explicit approval, THEN build back end.
- Deferred: P4 dead-link help; B pixel-snapshot copy.

## File conventions

- Scenario ID: SCN-NNN (assigned sequentially)
- Artifact locations:
  - Goal statement: context/goals.md
  - Scenarios: context/scenarios/SCN-NNN.md
  - Scenario index: context/scenarios-index.md
  - Non-functional backlog: context/non-functional-backlog.md
  - Prototypes: prototypes/
  - Implementation: implementation/

## Autonomous management

The facilitator manages all artifacts (scenarios, goals, backlog) autonomously
at appropriate moments. Do not ask the client to organise anything or delegate
management to them. Update the current state (Phase, step, scenario count)
autonomously as well.

## Prohibitions

- Do not implement based on unapproved scenarios
- Do not do final implementation in Phase 1 (exploratory prototypes are allowed)
- Do not handle assumptions implicitly
- Do not ask the client questions in technical terms
- Do not show GWT/Gherkin to the client
- Do not hand over a whole prototype and say "take a look"
- Do not enumerate interaction options as text
- Do not ask the client to perform management actions
- Do not propose the Phase 2 switch without edge-case exploration
