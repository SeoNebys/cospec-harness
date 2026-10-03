# Facilitation principles

Principles applied in common across all steps of Phase 1.
They apply identically regardless of the cycle iteration.

---

## Prototype first

When presenting a scenario to the client, use a **working prototype** by
default, not a textual description. Fall back to text only when a prototype
cannot express it, and record the reason in the session log.

A prototype **simulates the external behaviour** of the software for exploration.
Keep its code in `prototypes/`, separate from the production implementation.
Do not reference, copy, adapt, or reuse Phase 1 prototype code as a basis for
Phase 2 implementation. Carry approved behaviour forward through the approved
scenarios' GWT specifications. This restriction does not require deleting the
prototype artifacts retained for review or traceability.

---

## Guided confirmation

Do not hand over a whole prototype and say "take a look." Guide a concrete
action per scenario, and collect only the client's reaction to that action's
outcome.

- Guide one action at a time
- Do not leave the client to decide what to do on their own
- Do not make open-ended requests like "take a look" or "try it out"
- Write guidance in non-technical language

### Per-element assumption disclosure

If the facilitator has made assumptions about individual UI elements in the
prototype, disclose them together with the guidance.

Guidance pattern:
  "[action guidance]. Note that I set up [element] as [assumption] —
   please also check whether that approach is right."

Disclosure is needed when:
- The facilitator decided the composition of items shown in a list
- The facilitator decided the screen layout or structure
- The facilitator picked a single interaction method to present

Disclosure is not needed when:
- The client has already explicitly confirmed it
- It is a universally self-evident UI convention

---

## Separating what is approved

What the client approves is the **behaviour** of the prototype. GWT (Gherkin) is
a technical artifact the LLM derives internally from the approved behaviour; it
is neither shown to nor approved by the client.

Not shown to the client:
- Gherkin-format GWT scenarios
- BDD test code
- Technical implementation details
- The contents of scenario files and index files

---

## Incremental prototype evolution

Do not present all features at once as a prototype. Start from a single core
happy path, and add features to the prototype incrementally as each scenario is
approved.

As the prototype grows, also check that previously approved behaviour has not
been broken by the new feature.

---

## Distinguishing negative reactions

Distinguish three kinds of client negative reaction.

### Requirement mismatch
The behaviour itself differs from the client's intent.
-> Revise the scenario or derive a new one.
-> The Gherkin changes.

### Implementation error
The intended behaviour is not technically realised correctly.
-> Fix the prototype only.
-> Do not change the scenario or the Gherkin.
-> After fixing, repeat the same guidance to re-confirm the behaviour.

### Uncertain reaction
The client says "I'm not sure."
-> Tacit knowledge that cannot yet be put into words.
-> You must present 2-3 alternative prototypes to elicit a selection.
-> Do not enumerate options as text.

### When the classification is ambiguous
Ask the client:
  "Is the behaviour itself not what you want, or is it that the behaviour is
   not working properly?"

---

## Non-functional requirement filtering

When non-functional feedback appears in the client's reaction:
1. Record it autonomously in context/non-functional-backlog.md
2. Tell the client:
   "I've noted [content]. For now let's lock down the functional flow first
    and address that later."
3. Do not interrupt the current loop

Criteria for non-functional feedback:
- UI/UX preferences (size, colour, placement, animation)
- Performance expectations (response speed, throughput)
- Security requirements (authentication strength, encryption level)
- Availability / scalability expectations

Even if the client does not explicitly express a non-functional requirement, if
a recurring expression or preference pattern is observed during the conversation,
the facilitator records it in the non-functional backlog autonomously.

---

## Alternative prototypes

When exploring interactions and handling uncertain reactions, always present
2-3 alternative prototypes. The alternatives must differ only in the interaction
in question and be otherwise identical, so the client can compare the difference.
Presenting only one alternative for confirmation does not count as interaction
exploration.
