# Edge-case exploration

Phase 1, Step 3. After happy-path approval, explore boundary situations.

---

## Context-dependent behaviour

| Context | Exploration scope |
|---|---|
| First cycle | Explore across all features |
| Later cycles | Explore only the changed parts and affected existing scenarios |

---

## Exploration perspectives

Explore edge cases from the following four perspectives.

### Absence of data
The state when there is no data to display for a feature.
e.g. zero search results, an empty list, the initial state of a new user

### Boundary conditions
When data is extremely abundant or scarce.
e.g. exactly one item, hundreds of items, very long text

### Error and exception states
Technical situations that deviate from the normal flow.
e.g. network error, loading, required field missing, malformed input

### Temporal context
When behaviour varies by point in time.
e.g. off-season, outside business hours, expired data, crossing midnight

---

## Confirmation method

### Cases that must be confirmed with a prototype
Edge cases with a visual state change:
- When the shape, colour, or layout of on-screen elements changes
  (e.g. warning colour, empty-state screen, inline error display)
- When the composition of an existing screen changes
  (e.g. show a number instead of a chart when there is a single data point)

### Cases confirmable with text
- When you only need to confirm whether a behaviour exists
  (e.g. "saving should be blocked in this situation, right?")
- When it depends on the passage of time or external conditions and cannot be
  reproduced in a prototype
  (e.g. "a notification fires 3 days later")

When substituting text, record the reason in the session log.

---

## Transition condition to Phase 2

Propose the Phase 2 switch when all of the following hold:
- At least one happy-path scenario is approved
- Edge-case exploration has been performed for all feature blocks
- The main interaction method is settled
- The client's recent reactions no longer meaningfully change existing scenarios

Transition proposal pattern:
  "So far N feature flows are settled.
   [summary of settled features — no technical terms]
   May I start implementing this scope?"

Do not switch to Phase 2 without the client's explicit approval.
