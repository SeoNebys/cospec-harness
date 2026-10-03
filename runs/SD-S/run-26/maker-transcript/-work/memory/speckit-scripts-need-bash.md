---
name: speckit-scripts-need-bash
description: "Spec Kit shell scripts must be run with bash, not sh, in this repo"
metadata: 
  node_type: memory
  type: reference
  originSessionId: aab36c95-5f2f-47be-8659-17bb92ed3854
  modified: 2026-09-26T23:37:05.980Z
---

The Spec Kit helper scripts under `.specify/scripts/bash/` (e.g. `setup-plan.sh`,
`setup-tasks.sh`, `check-prerequisites.sh`) use bash-only features. Running them
with `sh` fails with "Bad substitution" / "source: not found". Invoke them as
`bash .specify/scripts/bash/<script>.sh ...`.

The project follows Spec-Driven Development (see CLAUDE.md): artifacts live under
`specs/<NNN-feature>/`. The bookmark-manager feature is `specs/001-bookmark-manager/`.
