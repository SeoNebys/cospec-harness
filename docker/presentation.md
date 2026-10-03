# Application presentation on the Linux VM

## Fixed routes for new trials

All methods receive the same operational runtime policy. This does not prescribe
an application framework, database, or requirement-elicitation method.

| Purpose | Maker binds | Director URL | VM capture URL |
|---|---|---|---|
| Implemented application | `0.0.0.0:4000` | `http://maker:4000` | `http://127.0.0.1:4000` |
| HTTP prototype | `0.0.0.0:4001` | `http://maker:4001` | `http://127.0.0.1:4001` |

Maker and Director join the `cospec-experiment` Docker network. Only loopback
ports are published to the VM. A page's actual path/query string is appended to
the appropriate base URL. This does not expose the service to a remote browser.
Standalone prototype files continue to be delivered under `/presentation/`.

Setup records `.harness/runtime-contract.json` and appends
[the runtime policy](../config/runtime-presentation.md). Maker registers:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

A prototype uses `kind: prototype` and port 4001. The page marks a visible,
loaded element with `data-harness-ready="true"`, including valid empty/login
states. The marker is an operational readiness signal, not feature coverage.
New trials use this shared marker; arbitrary `ready_selector` values do not
control their capture checks. Maker must demonstrate the state being reviewed,
not a loading/error placeholder. Login cookies must work over review HTTP.

The Broker starts the registered command in a detached Docker exec if the
actual application is not listening. For published ports, this probes inside
Maker, because Docker's port proxy can accept connections without a running
application. It attempts startup at most once per round. Logs remain under
`.harness/runtime/` and do not affect workspace-change detection. An already
running server is not overwritten; Maker stops/restarts it when changing its
startup command or built code. Separate ports prevent the prototype from being
mistaken for the implemented application.

## Capture and delivery

The VM captures the actual HTTP page using its Python virtual environment.
Successful captures are also checked for Director-to-Maker DNS/TCP reachability,
without replaying GET requests that may prepare or change an acceptance state.
Director receives its own reachable URL, the screen image and visible text.
Capture diagnostics record both routes and the artifact kind. These checks do
not verify every interaction, authenticated route or requirement.

Application errors are presented to Director. Capture-environment failures
retain the completed Maker response and use bounded retries in the same round.
New trials record `interruption: stop` in `session/control.json`. Once these
retries are exhausted, preserve the interrupted trial; `--resume-session` is
rejected. Interrupted model calls, including quota failures that may follow
partial work, are not automatically replayed. Any rerun uses a separate trial
and records its relationship to the interrupted attempt. Legacy sessions without
this interruption policy retain their old explicit presentation-resume path;
this is not a procedure for new research trials.

## Final acceptance

New trials record `session/control.json` with `termination: director_tag`.
Director appends `<FINAL_ACCEPTED>` on its own final line only when accepting the
complete implementation. The same rule applies to both participation policies.
The tag is stripped from dialogue `content`, `relayed`, and character counts;
`raw_content` and `control.final_accepted` preserve it separately. Native usage
records still include all generated tokens, including protocol overhead.

- Final tag plus a declared application: `accepted` in the summary, `completed`
  in matrix status, regardless of capture/readiness diagnostics. These diagnostics
  remain in the presentation record; they do not override client acceptance.
- A tag on a prototype/specification cannot finish the application.
- Unchanged artifacts do not terminate a new trial. Without final acceptance,
  dialogue continues until the configured round cap (`capped`) or an execution error.

An accepted application is not thereby fully covered or fully tested. Coverage
is assessed separately. No complete-test gate or per-utterance review-evidence
audit is required. New terminal outcomes are completed and capped.
Historical incomplete and needs_verification results remain unchanged and are still recognized
when reading old batches. Terminal outcomes are skipped on queue restart; none
is silently reclassified or rerun. Newly configured trials wait for Director even
when Maker declares Idle. Legacy sessions without the control record retain
the previous convergence/stall behavior; their frozen input snapshots are not
rewritten to pretend they used the new protocol.

Because no extra Maker call follows final acceptance, Maker's own phase file
may still say Acceptance rather than Idle. `session/final-acceptance.json` and
the recorded Director response are the authoritative acceptance evidence for
these trials.

## Validation

[The model-free operational check](../pilots/operational-contract-check-20260915/verification.json)
validated distinct application/prototype routes, VM capture, actual Director
HTTP access, Python and Node Chromium clicks as the non-root user, and one-round
final-tag termination using fixed model-response fixtures. No model calls or
research trials were launched. New model compliance still needs a future pilot.
