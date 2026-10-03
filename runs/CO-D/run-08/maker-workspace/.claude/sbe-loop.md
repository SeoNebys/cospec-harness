# SbE reaction loop

Phase 1, Step 2. Concretise requirements based on prototypes.

---

## Context-dependent behaviour

| Context | Starting point | Exploration scope |
|---|---|---|
| First cycle | Empty state | All features |
| Later cycles | Existing behaviour | Scenarios limited by impact analysis |

---

## Loop structure

```
create/modify prototype
      |
      v
guided confirmation
  (see principles.md)
      |
      v
collect and classify reaction
  "correct"        -> approve behaviour
  "different"      -> classify negative reaction (see principles.md)
  "what about..."  -> register as an edge-case candidate
  "not sure"       -> present alternative prototypes (see principles.md)
      |
      v
derive Gherkin (invisible to client)
      |
      v
active extension
      |
      v
grow prototype incrementally -> repeat loop
```

---

## Guided-confirmation procedure

1. While presenting the prototype, guide the first confirmation action.
   "[This is flow N. Concrete action] — please try it."

2. The client performs that action and reacts.

3. Branch on the reaction.
   (See negative-reaction classification in principles.md)

4. After all guided scenarios of this prototype are done, do a summary check.
   "Do all the behaviours we've checked so far match your intent?"

5. After the summary check, derive Gherkin internally for the approved behaviour.

---

## Active extension

### Functional path exploration

After a happy-path scenario is approved, detect edge cases derivable from that
flow.

- Have the client experience them via guided confirmation
- If the client says "that doesn't need to be handled," just record it and move on

### Interaction exploration

After a feature is approved, explore the user's manipulation method.

Mandatory exploration conditions:
- When several input methods are possible
  -> present 2-3 alternative prototypes (see principles.md)
- When a compound manipulation is needed
  -> demonstrate the manipulation flow via guided confirmation in the prototype
- When introducing a method different from existing tools
  -> show the difference as a prototype and confirm
- When a new manipulable element is added
  -> perform interaction exploration for that element's manipulation method
  -> exclude self-evident manipulations (simple text entry)
  -> mandatory when there are options (viewer, date picker, sort, etc.)

---

## Gherkin derivation

### Timing
Right after the summary check of guided confirmation is complete and the client
has approved the behaviour.

### Format
Follow standard Gherkin grammar.
One scenario (SCN-NNN) may contain multiple Gherkin Scenarios.

### Self-consistency check
After derivation, self-verify the following:
- Do the approved behaviour and the Gherkin Given/When/Then match?
- Are all behaviour paths included in the Gherkin?
- Are assumptions reflected in the Gherkin?

### File management
The facilitator autonomously saves scenario files and updates the index.
In later cycles, update existing scenarios or add new ones.

---

## Scenario file format

```
Scenario ID: SCN-NNN
Title: [short sentence describing the scenario]
Type: Happy Path | Edge Case | Error Case
Approval status: pending | approved | needs revision
Approval session: SESSION-NNN
Approval cycle: [N]

## Approved behaviour
[natural-language description of the behaviour the client experienced and approved
 during guided confirmation]

## Gherkin
Feature: [feature name]

  Scenario: [scenario name]
    Given [initial state]
    When  [action]
    Then  [expected result]

## Assumptions
- [list of assumptions premised in this scenario]

## Related scenarios
- [related scenario IDs]
```

## scenarios-index.md format

```
| ID | Title | Type | Approval status | Approval session | Cycle |
|----|-------|------|-----------------|------------------|-------|
```

---

## Transition condition to Step 3 (edge-case exploration)

- At least one happy-path scenario is approved
- The main interaction method is settled
- The client's recent reactions no longer meaningfully change existing scenarios

On transition, enter edge-case exploration without a separate notice to the client.
