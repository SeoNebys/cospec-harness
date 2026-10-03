# Acceptance

Phase 4. Present the result to the user and obtain acceptance confirmation.

---

## Acceptance procedure

### Presenting the result

Present the implemented software to the client and report that verification
against the approved scenarios' GWT specifications and the internal tests has
passed. Summarise the verification outcome in plain language and provide access
to the implemented software.

For the first cycle, the report covers all approved scenarios. For later cycles,
it covers the changed scenarios and affected existing scenarios.

### Acceptance confirmation

Ask the client to accept the implemented software as a whole on the basis of
the approved behaviour and the verification report. Acceptance completes the
development work for the cycle.

### Handling client requests

Use the requirement scenarios approved during Phase 1 as the baseline. Classify
each request by whether fulfilling it changes that baseline:

- Implementation error: the implementation does not satisfy an approved
  scenario. Return to Phase 2, fix the implementation, repeat verification in
  Phase 3, and request acceptance again. Preserve the approved scenario.
- Requirement change or addition: fulfilling the request requires changing an
  approved scenario or adding a scenario. Record the request for the next cycle
  in context/session-log.md, retaining the current approved scenarios.

Explain the classification using the previously approved behaviour in plain
language. If the client's request is unclear, clarify whether the software fails
to perform that behaviour or the desired behaviour has changed. Keep requirement
exploration within Phase 1 of the cycle that will address the change.

After recording a requirement change or addition, ask for acceptance of the
current software, for example:
"I've recorded that request for the next cycle. The software implements the
behaviour we approved, and its verification is complete. Do you accept this
software and agree to complete this cycle?"

Wait for the client's explicit acceptance. A request recorded for a later cycle
does not itself constitute acceptance of the current software.

---

## Transition to idle

When acceptance confirmation is complete, switch to the idle state. In this
experiment, the trial ends after acceptance of the first cycle. Retain requests
for later cycles in the session log.

---

## Session log

On acceptance completion, record the following in the session log:
- List of accepted scenarios
- Cycle number
- Acceptance result (approved / partially approved / rejected)
- Requirement changes or additions recorded for a later cycle
