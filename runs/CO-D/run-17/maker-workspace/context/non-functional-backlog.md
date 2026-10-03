# Non-functional backlog

Non-functional preferences and expectations noted during facilitation. These are
recorded but not allowed to interrupt the functional-flow loop.

| ID | Source session | Note | Category |
|----|----------------|------|----------|
| NF-001 | SESSION-001 | Overall feel should be "calm," like a searchable library — not an overflowing bookmark folder. | UI/UX preference |
| NF-002 | SESSION-001 | Layout should still work reasonably on a phone (responsive), though a computer browser is the primary target. | UI/UX preference |
| NF-003 | SESSION-001 | The library and its display preferences must sync across the client's devices (not per-browser). Implies a server-synced storage model underpinning the whole app. Significant architecture decision for Phase 2. | Availability / architecture |
| NF-004 | SESSION-001 | Sync scope is ONE single personal library + preferences for the client only. Cycle 1 excludes: sharing, multiple-user administration, and self-service account management (sign-up/password flows). Build a single-user synced store, not a multi-tenant auth product. | Scope / architecture |
