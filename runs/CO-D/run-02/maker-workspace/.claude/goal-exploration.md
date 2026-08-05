# Goal exploration

Phase 1, Step 1. Understand the user's request and settle the direction.

---

## Context-dependent behaviour

### First cycle

No prior artifacts. Start from the user's tacit knowledge.

#### Facilitation question patterns

Level 1 — goal level (WHY first)
  "When this is finished, what should be different from now?"
  "Why are you building this?"

Level 2 — scope check
  "Is [mentioned feature] the core, or is it a means and the real goal lies
   elsewhere?"

Level 3 — making assumptions explicit
  "What I understood is ~. Is that direction right?"

#### Interface form check

After the goal statement is confirmed, and before entering the SbE loop, always
confirm the interface form.

If the client already mentioned it
(e.g. "as a web app", "as a console app", "as a mobile app")
proceed with that form without a separate check.

If the client did not mention it:
  "What kind of app do you have in mind?
   For example web, mobile, desktop, terminal (CLI), etc."

The interface form determines the prototyping method:
- Web/desktop: HTML-based interactive prototype
- Mobile: mobile-layout prototype
- CLI (one-way): simulate the expected output
- CLI (interactive/TUI): web-based terminal simulator or step-by-step output simulation

#### Behaviour rules
- Do not mention implementation methods or tech stack in this step
- Record the client's utterances verbatim (do not reinterpret)
- Write the goal statement in the client's language
- On goal confirmation, record it autonomously in context/goals.md

#### Artifact
Record the business goal statement in context/goals.md

---

### Later cycles

Prior artifacts exist. The change request itself is the goal.

#### Change-goal check

Understand the user's change request.
Confirm the motivation for the change ("why do you want to change it").
The solution direction may vary with the motivation.

#### Impact analysis

Referring to the internal information system (design decisions, scenario-code
mapping), analyse which existing Gherkin scenarios the change affects.

Present the impact-analysis result to the user.
Per the facilitation principles, rather than listing text, show the current
behaviour of the affected scenarios as a prototype and present what changes via
guided confirmation.

When the user confirms the impact scope and approves proceeding with the change,
enter the SbE loop (Step 2). The exploration scope is then limited to the impact
analysis.

#### Artifact
Confirmed change goal, list of affected scenarios

---

## Transition to Step 2

Once the goal is confirmed, tell the client:
  "I've confirmed the goal. Now let's go through the concrete usage flows one by
   one. I'll show you a working screen, so please follow the guidance, operate
   it, and give me your thoughts."

Then follow the rules in sbe-loop.md.
