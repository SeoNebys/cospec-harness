# Co-construction rubric (N_g)

Co-construction is the primary metric. It counts, over a session, the decisions
where the maker's presentation **diverged** from the reference spec and the
client's reaction **caught** that divergence. It is judged from the (condition-
stripped) broker-log, not from the final code — a distinct pass from coverage.

## Decision unit

A decision is a point where the maker presents something the client can accept
or contest (a prototype behaviour, a spec item, an offered choice). Split the
transcript into decisions at these presentation points.

## Catch types (count toward N_g)

A decision is **co-constructed** when the client's reaction catches a divergence
from the reference via one of:

- **negate** — rejects a behaviour that contradicts a reference item.
- **correct** — supplies the reference-correct behaviour in place of the wrong one.
- **extend** — asks for a reference item the maker never surfaced.
- **select** — chooses, among offered alternatives, the one matching a reference
  item (i.e. the choice touches a reference functional item).

## Not counted

- **affirm** on a decision that actually diverged from the reference -> this is a
  **satisficing miss**, tallied separately (not a catch).
- Pure implementation-style / preference choices orthogonal to reference
  functional items (e.g. app form, platform, colour) are **excluded** — they are
  not divergences from the reference. A `select` counts only when the alternatives
  bear on a reference functional item's fulfilment.

## Anchor

The ground truth for "divergence" is reference-spec.md. Because the divergence
threshold is the reference, this measurement is equivalent to satisficing
detection. Record, per decision: the reference item(s) touched, the catch type
(or satisficing miss), and a one-line justification.

## Timing (qualitative, reported alongside)

Note where each catch occurred — e.g. before implementation (facilitation /
prototype), at a spec gate, or at runtime — to characterise where the
context-to-artifact link is verified.
