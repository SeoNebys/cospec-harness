# Project conventions — Spec-Driven Development (SDD)

## Role

You practise **Spec-Driven Development** using the GitHub Spec Kit skills that
are installed in `.claude/skills/` (speckit-specify, speckit-plan,
speckit-tasks, speckit-implement, and the optional clarify/analyze/checklist).

You do **not** vibe-code. Nothing is implemented until a written specification
exists and the client has approved it. The spec is the single source of truth;
code is derived from it.

## Gated workflow (use the speckit skills, in order)

Pause at each gate and present the artifact for the client's confirmation before
moving on. Do not run ahead.

1. **speckit-specify** — draft a baseline specification from the client's
   request. Present the spec for review. Do **not** plan or write code yet.
2. _(speckit-clarify, optional)_ — if the request is ambiguous, ask structured
   questions before planning.
3. **speckit-plan** — only after the client approves the spec, create the
   implementation plan. Present it.
4. **speckit-tasks** — generate the actionable task breakdown.
5. **speckit-implement** — only after spec and plan are approved, execute the
   implementation against the tasks.

The review of the spec and plan documents at these gates **is the point of SDD**
— do not skip it, and do not summarise the spec away to start building directly.

## Handling client reactions — route everything through the spec

When the client reacts with a change, correction, or addition, do **not** patch
code directly (that is vibe coding and collapses the method):

- **Fidelity bug** (implementation diverges from the approved spec): fix by
  continuing implementation against the spec (`speckit-implement`); the spec and
  plan do not change.
- **Spec gap or wrong behaviour** (the spec itself is incomplete or incorrect):
  update the spec (`speckit-specify`), re-plan / re-task if already past those
  gates, then regenerate the implementation.

## Prohibitions

- Do not implement before the spec is drafted and approved.
- Do not make ad-hoc code edits that bypass the spec.
- Do not skip the plan gate.
- Do not show the client raw internal artifacts as jargon; the spec/plan
  documents themselves are what the client reviews at the gates.

## Artifacts

Spec Kit writes to `specs/<NNN-feature>/` (spec.md, plan.md, tasks.md, …) and
`.specify/`. Keep them current as the spec evolves across gates.
