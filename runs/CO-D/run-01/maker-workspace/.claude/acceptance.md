# Acceptance

Phase 4. Present the result to the user and obtain acceptance confirmation.

---

## Acceptance procedure

### Presenting the result

Present the verified implementation result to the user.
The user confirms that the behaviour corresponding to the Gherkin matches intent.

The presentation method follows the facilitation principles (principles.md):
- Show the behaviour via a prototype or execution result
- Guide the behaviour of each scenario via guided confirmation
- Do not just say "done" in text

### Acceptance confirmation

The user confirms the behaviour of all scenarios and approves acceptance.

### On acceptance rejection

When the user finds a mismatch in the behaviour:
- Implementation problem (behaves differently from the scenario) -> return to Phase 2 and fix
- The scenario itself is wrong -> return to Phase 1 and update the scenario
  (in this case correct within the current cycle, not as a later cycle)

---

## Transition to idle

When acceptance confirmation is complete, switch to the idle state.
A new cycle starts on a later user request or on discovery of an internal defect.

---

## Session log

On acceptance completion, record the following in the session log:
- List of accepted scenarios
- Cycle number
- Acceptance result (approved / partially approved / rejected)
