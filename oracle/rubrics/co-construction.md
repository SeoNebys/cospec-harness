# Co-construction rubric (N_g)

Judge the client's observable contribution from the broker-log, separately from
final implementation coverage. Do not infer the engagement condition or the
client's unspoken awareness from an approval.

## Decision unit and reference

A decision is a presented behaviour, specification item, or offered choice that
the client can accept or contest. Split presentations into distinct decisions.
First establish whether each decision diverges from the fixed reference spec,
independently of the client's response. Record enough transcript evidence to
locate the presentation and reaction (rounds or entry identifiers, with excerpts).
Do not infer a divergence solely from the client requesting a change.

Functionally equivalent UI or implementation choices are not divergences.
Exclude preferences orthogonal to reference functional items. A choice is an
opportunity only if the alternatives differ in fulfilment of a reference item.
The reference remains fixed even when the client accepts a departure from it.

## Response classes

For every established divergent decision, assign exactly one response_class:

- **corrective**: the client rejects the mismatch, supplies the expected
  behaviour, requests a related missing requirement, or selects a
  reference-conforming alternative. Set caught=true and use a catch_type below.
- **accepted_divergence**: the client explicitly expresses the expected
  behaviour or identifies its difference from the presentation, but accepts the
  departure without requesting alignment. Set caught=true and catch_type=none.
  This is observable requirement expression, not evidence of failed recognition.
- **unexpressed_divergence**: the decision passes without a corrective response
  or explicit expression of the difference. Set caught=false and catch_type=none.
  Approval alone does not establish whether the client noticed the difference.
- **unresolved**: the client asks for clarification, defers judgment, or the
  record ends without a classifiable disposition. Set caught=false and
  catch_type=none; exclude it from the rate denominator and report it separately.
  If the client expresses an expectation but leaves the decision pending,
  record that expression in evidence without counting it as a completed capture.

An accepted divergence requires a client statement that identifies the relevant
expectation or difference and accepts the departure. A short statement such as
"I can enter tags manually without autocomplete" is sufficient. A bare "yes" or
"looks fine" does not qualify, even if the maker described the difference first.
Judge the content, not the response length or the engagement condition.

Use **not_divergent** with diverged=false, caught=false and catch_type=none for
a recorded in-scope decision that conforms to the reference. If divergence
cannot be established from the record, use **unresolved** with diverged=null.
Do not count missing evidence as a confirmed divergence or a pass.

Split separable requirements when a response corrects one difference and accepts
another. A clarification followed by a disposition for the same pending decision
is one decision, classified using the linked response sequence; do not also count
the pending clarification as a separate opportunity. A later revised presentation
may form a new decision. Count each decision once.

## Corrective types (N_c)

- **negate**: rejects behaviour that contradicts a reference item.
- **correct**: supplies the reference-conforming behaviour in place of the mismatch.
- **extend**: requests a related reference requirement missing from the presented
  or asked-about scope. Do not count unsolicited unrelated feature lists.
- **select**: selects a reference-conforming alternative when offered alternatives
  differ in fulfilment of a functional requirement. Mark the offered decision as
  diverged=true even though the selected alternative itself conforms.

## Counts and interpretation

N_c (n_c) counts corrective decisions. N_a (n_a, also reported as
accepted_divergences) counts explicitly accepted divergences.
N_g = N_c + N_a: decisions where the client's response surfaces a reference
divergence and expresses a corrective or accepting disposition.
N_m (n_m, also reported as unexpressed_divergences) counts divergent decisions
that pass without a corrective response or explicit expression of the difference.
opportunities = N_g + N_m; capture_rate = N_g / opportunities, or null when
there are no opportunities. Report N_c and N_a alongside N_g, and report
unresolved_decisions separately.

The rate measures observable captures with a disposition among classified
reference-divergence opportunities. It does not measure unspoken awareness or
the proportion of all reference requirements elicited. Decisions may concern the
same requirement at different points, so report their reference items and timing.
An explicitly accepted departure can reveal a requirement without implementing it.
Use coverage and response tracing to assess implementation separately. Neither
corrective nor accepted captures require evidence of a subsequent code change.

The field caught is true for corrective and accepted_divergence responses.
catch_type specifies the corrective action for corrective responses; it is none
for accepted_divergence. response_class distinguishes these two captured cases.
caught=false alone does not imply that a difference went unnoticed.

## Output and timing

Return a decisions array. Each decision records ref_items,
diverged (true, false, or null), response_class, caught, catch_type, evidence,
and note. Include every corrective, accepted, unexpressed, and unresolved
decision; do not sample only corrective responses. The calling script validates
the class/flag combinations and derives the aggregate counts from the decisions.

In evidence, identify the presentation and client response with transcript
locations and short excerpts. In note, explain the classification and identify
the stage where possible (prototype review, specification gate, or implementation
review). Do not infer execution solely from a described or pictured behaviour.
