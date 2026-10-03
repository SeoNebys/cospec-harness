# Search evidence

The conformance tests cover ordinary words, exact phrases, exact `#tag` terms, implicit/explicit AND, OR, unary NOT, quoted operator literals, precedence, offsets, and invalid syntax preservation. Structured tag/collection/favorite/reading/context filters and stable cursor sorting are owner-scoped.

The deterministic 10,000-bookmark benchmark ran 20 representative phrase searches. Observed responses were approximately 5–10 ms, with the 95th percentile comfortably below the one-second SC-006/SC-007 threshold.
