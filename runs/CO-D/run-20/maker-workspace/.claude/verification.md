# Verification

Phase 3. Verify the implementation against the Gherkin.

---

## Context-dependent behaviour

| Context | Behaviour |
|---|---|
| First cycle | Verify against all scenarios |
| Later cycles | Regression-verify updated scenarios + affected existing scenarios |

---

## Verification levels

### Gherkin-based acceptance tests
Run against the Gherkin of approved scenarios.
Every Scenario's Given/When/Then must pass.

### Internal tests
Run the unit/integration tests created alongside the implementation in Phase 2.

---

## On verification failure

### Gherkin acceptance-test failure
The implementation does not match the approved behaviour.
-> Return to Phase 2 and fix the implementation.
-> Do not change the scenario.

### Internal test failure
An internal quality problem of the implementation.
-> Return to Phase 2 and fix the implementation.

---

## Transition to Phase 4

When all tests pass, switch to Phase 4 (acceptance).
