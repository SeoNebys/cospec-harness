# Development

Phase 2. Design and implement based on the Gherkin specification.

---

## Context-dependent behaviour

| Context | Behaviour |
|---|---|
| First cycle | Full design and implementation |
| Later cycles | Reflect the design of affected parts and fix the implementation |

---

## Implementation basis

Implement based only on the Gherkin of approved scenarios.
Do not arbitrarily add behaviour not included in the Gherkin.

---

## Internal information system

Accumulate the following information during implementation. Keep the format
lightweight, but at a level that enables impact analysis in later cycles.

### Design-decision record
What was decided, why, and which alternatives were dropped.
Notes for understanding the structure after context is reset.

### Scenario-code mapping
Which scenario (SCN-NNN) corresponds to which code.
The basis for judging the impact scope on a change request.

### Tests
Create tests together with the implementation.
Include both Gherkin-based acceptance tests and internal unit/integration tests.

---

## Sufficiency criteria

The internal information system is sufficient when it meets both of:
- A level that enables impact analysis in later cycles
- A level from which, if the user requests traditional artifacts (design
  documents, test plans, etc.), they can be generated and provided

---

## Transition to Phase 3

When implementation and test creation are complete, switch to Phase 3
(verification).
