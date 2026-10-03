# Project conventions — Spec-Driven Development (SDD)

## Role

You practise **Spec-Driven Development** using the GitHub Spec Kit skills that
are installed in `.agents/skills/` (speckit-specify, speckit-plan,
speckit-tasks, speckit-implement, and the optional clarify/analyze/checklist).

You do **not** vibe-code. Nothing is implemented until a written specification
exists and the client has approved it. The spec is the single source of truth;
code is derived from it.

## Gated workflow (use the speckit skills, in order)

Pause at each gate and present the artifact for the client's confirmation before
moving on. Do not run ahead.

1. **speckit-specify** — draft a baseline specification from the client's
   request. Present the spec for review. Do **not** plan or write code yet.
2. *(speckit-clarify, optional)* — if the request is ambiguous, ask structured
   questions before planning.
3. **speckit-plan** — only after the client approves the spec, create the
   implementation plan. Present it.
4. **speckit-tasks** — generate the actionable task breakdown.
5. **speckit-implement** — only after spec and plan are approved, execute the
   implementation against the tasks.

The review of the spec and plan documents at these gates **is the point of SDD**
— do not skip it, and do not summarise the spec away to start building directly.

## Handling client reactions — route everything through the spec

When the client reacts with a change, correction, or addition, do **not** patch
code directly (that is vibe coding and collapses the method):

- **Fidelity bug** (implementation diverges from the approved spec): fix by
  continuing implementation against the spec (`speckit-implement`); the spec and
  plan do not change.
- **Spec gap or wrong behaviour** (the spec itself is incomplete or incorrect):
  update the spec (`speckit-specify`), re-plan / re-task if already past those
  gates, then regenerate the implementation.

## Prohibitions

- Do not implement before the spec is drafted and approved.
- Do not make ad-hoc code edits that bypass the spec.
- Do not skip the plan gate.
- Do not show the client raw internal artifacts as jargon; the spec/plan
  documents themselves are what the client reviews at the gates.

## Artifacts

Spec Kit writes to `specs/<NNN-feature>/` (spec.md, plan.md, tasks.md, …) and
`.specify/`. Keep them current as the spec evolves across gates.

## Runtime presentation environment

The client reviews artifacts through a separate container. For a runnable web
application, configure its HTTP server to listen on `0.0.0.0`. Use port `4000` for the final application and port `4001` for an HTTP
prototype. The client reaches these at `http://maker:4000` and
`http://maker:4001` on the shared Docker network. Do not give the client
`localhost` or a container IP. The VM capture uses the corresponding
`http://127.0.0.1:<port>` address; these addresses serve different callers.

Once the application is ready for review, write `/work/.harness/app.json`:

```json
{"kind": "application", "port": 4000, "path": "/", "start_command": ["npm", "start"], "start_cwd": "/work"}
```

Use `kind: application` with port 4000, or `kind: prototype` with port 4001.
Keep the actual entry path and foreground server command current. `start_command`
is an argument array, not a shell command string. Complete dependency installation
and builds first; this command only starts the prepared application. `start_cwd`
defaults to `/work` and must remain below that directory. For example, a static
prototype can use `["python3", "-m", "http.server", "4001", "--bind", "0.0.0.0",
"--directory", "prototypes"]`.

The broker starts the declared command in a detached container process when the
port is not listening, so it survives the end of your model call. A long-running
foreground tool session alone is not sufficient. Logs are in
`/work/.harness/runtime/server.log`; a failed server receives at most one start
attempt per dialogue round. If it fails, inspect and fix the cause before the
next review. Do not rely on this mechanism to implement or repeatedly retry a
failing application until it succeeds.

Mark a visible application element with `data-harness-ready="true"` only after
its initial UI and necessary data have loaded. The same marker applies to a
valid empty state, login page, or static prototype; do not mark a loading/error
placeholder as ready. The harness uses this shared marker instead of a custom
CSS selector. This confirms presentation readiness, not feature correctness.
If startup arguments or built code change, stop your previous application
server before requesting another presentation; an already-running server is
not silently replaced. The prototype and application must not share a port.
When login is required, provide working review credentials or a review entry
path using the actual implementation. Make HTTP-session cookies work in this
review environment; keep production deployment settings separate. Never claim
that a prepared state proves an interaction that was not performed.

Use the entry path and query string that show the state under discussion. For
COSPEC, save any post-action screenshots for the client under `prototypes/` and
name the relevant file in your guidance. Those images are copied with their
relative paths; `/work` itself is not shared with the client.

This is runtime delivery information, not a development method or a requirement
to implement before the client approves your method's relevant review gates.
For standalone COSPEC prototypes, continue using `prototypes/`; their existing
HTML and supporting files are delivered separately.

## Available runtime and verification tools

The shared image provides Node.js 24, npm, Python, a C/C++ build toolchain,
Playwright 1.61.0 for Python and Node, Chromium, and its Linux dependencies.
Use `python` (the image's browser-tools virtual environment) for Python browser
checks, and `playwright` for the installed CLI. Browser binaries are shared at
`/opt/playwright-browsers`. If using Playwright in a project's test imports,
pin `playwright` or `@playwright/test` to `1.61.0` in its development dependencies
so its browser revision matches the installed binaries. Do not download a
second browser version during a trial. Application frameworks and databases
are not prescribed; use compatible dependencies and preserve lockfiles.
Report unavailable external services and unfinished validation honestly.
