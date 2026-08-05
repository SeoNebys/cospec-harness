# Non-functional backlog

Non-functional concerns surfaced during facilitation. Recorded to address later;
they do not block the functional flow.

## Storage & saved copies (from SCN-016 / SCN-017)
- **Storage growth.** Auto-keeping a copy of every saved page will grow storage
  over time. Needs an escape valve (global off + per-link skip — captured
  functionally in SCN-016) and, later, some visibility into space used.
- **Visual snapshots are heavier** than readable copies. Weigh default on/off
  and per-link choice for visual capture specifically.
- **Capture reliability / best-effort.** Login walls, paywalls, and highly
  interactive apps can only be partially captured. Behaviour is honest labelling
  (SCN-016); the technical capture approach is a later concern.

## External services / privacy (from SCN-017)
- **Public web-archive lodging.** Opt-in per link only. Sending a URL to an
  independent public archive (e.g. an archive.org-style service) shares that URL
  with a third party and makes a public copy — must be explicit, per-link, never
  automatic. Privacy expectation to honour at build time.

## Reading comfort (committed — client, ties to founding "readability-first" value)
- The comfort set is EXACTLY TWO knobs (client, final): **text size** and a
  **light/dark** option. NOT a spacing knob — instead the default spacing must
  be made genuinely comfortable to read and left there. No sprawling settings
  screen; these two, no more.
- Appearance-only, so dialled in by feel during build rather than mocked here.

## Performance (watch)
- Live search filters as-you-type across the whole library; large libraries
  (hundreds–thousands of links + copies) must still feel instant. Revisit at
  implementation.
